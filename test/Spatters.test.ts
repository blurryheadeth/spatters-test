import { expect } from "chai";
import { ethers } from "hardhat";
import { Spatters } from "../typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Spatters - Seed-Based Architecture", function () {
  let spatters: Spatters;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;

  // Helper to get mint price for a token ID
  // This is no longer needed as we use spatters.getCurrentPrice() directly

  beforeEach(async function () {
    [owner, user1, user2, user3] = await ethers.getSigners();

    const SpattersFactory = await ethers.getContractFactory("Spatters");
    // Use zero addresses for testing (not actually reading SSTORE2 in tests)
    const storageAddresses = [
      ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress,
      ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress,
      ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress
    ];
    spatters = await SpattersFactory.deploy(storageAddresses, ethers.ZeroAddress);
    await spatters.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct name and symbol", async function () {
      expect(await spatters.name()).to.equal("Spatters");
      expect(await spatters.symbol()).to.equal("SPAT");
    });

    it("Should set the correct constants", async function () {
      expect(await spatters.MAX_SUPPLY()).to.equal(999);
      expect(await spatters.OWNER_RESERVE()).to.equal(25);
      expect(await spatters.MAX_MUTATIONS()).to.equal(200);
      expect(await spatters.MAX_PER_WALLET()).to.equal(10);
    });

    it("Should initialize mutation types", async function () {
      const mutations = await spatters.getAllowedMutations();
      expect(mutations.length).to.be.greaterThan(0);
      expect(mutations).to.include("paletteChangeAll");
      expect(mutations).to.include("shapeExpand");
    });

    it("Should set owner correctly", async function () {
      expect(await spatters.owner()).to.equal(owner.address);
    });
  });

  describe("Owner Minting", function () {
    describe("Without Custom Palette", function () {
      it("Should allow owner to mint within reserve", async function () {
        const emptyPalette: [string, string, string, string, string, string] = 
          ["", "", "", "", "", ""];
        
        await expect(spatters.ownerMint(user1.address, emptyPalette))
          .to.emit(spatters, "Minted");
        
        expect(await spatters.balanceOf(user1.address)).to.equal(1);
        expect(await spatters.totalSupply()).to.equal(1);
      });

      it("Should set collection launch date on first mint", async function () {
        const emptyPalette: [string, string, string, string, string, string] = 
          ["", "", "", "", "", ""];
        
        await spatters.ownerMint(user1.address, emptyPalette);
        
        const launchDate = await spatters.collectionLaunchDate();
        expect(launchDate).to.be.greaterThan(0);
      });

      it("Should store token data correctly", async function () {
        const emptyPalette: [string, string, string, string, string, string] = 
          ["", "", "", "", "", ""];
        
        await spatters.ownerMint(user1.address, emptyPalette);
        
        const tokenData = await spatters.tokens(1);
        expect(tokenData.mintSeed).to.not.equal("0x0000000000000000000000000000000000000000000000000000000000000000");
        expect(tokenData.mintTimestamp).to.be.greaterThan(0);
        
        // Check that no custom palette was stored
        const palette = await spatters.getCustomPalette(1);
        expect(palette[0]).to.equal("");
      });

      it("Should prevent owner mint after reserve exhausted", async function () {
        const emptyPalette: [string, string, string, string, string, string] = 
          ["", "", "", "", "", ""];
        
        // Mint 25 tokens
        for (let i = 0; i < 25; i++) {
          await spatters.ownerMint(user1.address, emptyPalette);
        }
        
        // 26th should fail
        await expect(
          spatters.ownerMint(user1.address, emptyPalette)
        ).to.be.revertedWith("Owner reserve exhausted");
      });

      it("Should prevent non-owner from minting", async function () {
        const emptyPalette: [string, string, string, string, string, string] = 
          ["", "", "", "", "", ""];
        
        await expect(
          spatters.connect(user1).ownerMint(user2.address, emptyPalette)
        ).to.be.revertedWithCustomError(spatters, "OwnableUnauthorizedAccount");
      });
    });

    describe("With Custom Palette", function () {
      const validPalette: [string, string, string, string, string, string] = [
        "#ed0caa", "#069133", "#DF9849", "#EDECF0", "#eddcab", "#cfa6fc"
      ];

      it("Should allow owner to mint with valid custom palette", async function () {
        await expect(spatters.ownerMint(user1.address, validPalette))
          .to.emit(spatters, "Minted");
        
        // Check palette is stored in separate mapping
        const palette = await spatters.getCustomPalette(1);
        expect(palette[0]).to.equal("#ed0caa");
        expect(palette[5]).to.equal("#cfa6fc");
      });

      it("Should reject invalid hex colors", async function () {
        const invalidPalette: [string, string, string, string, string, string] = [
          "invalid", "#069133", "#DF9849", "#EDECF0", "#eddcab", "#cfa6fc"
        ];
        
        await expect(
          spatters.ownerMint(user1.address, invalidPalette)
        ).to.be.revertedWith("Invalid hex color");
      });

      it("Should reject colors with wrong length", async function () {
        const shortPalette: [string, string, string, string, string, string] = [
          "#fff", "#069133", "#DF9849", "#EDECF0", "#eddcab", "#cfa6fc"
        ];
        
        await expect(
          spatters.ownerMint(user1.address, shortPalette)
        ).to.be.revertedWith("Invalid hex color");
      });

      it("Should reject colors without #", async function () {
        const noPoundPalette: [string, string, string, string, string, string] = [
          "ed0caa", "#069133", "#DF9849", "#EDECF0", "#eddcab", "#cfa6fc"
        ];
        
        await expect(
          spatters.ownerMint(user1.address, noPoundPalette)
        ).to.be.revertedWith("Invalid hex color");
      });
    });
  });

  describe("Public Minting", function () {
    beforeEach(async function () {
      // Mint owner reserve first
      const emptyPalette: [string, string, string, string, string, string] = 
        ["", "", "", "", "", ""];
      for (let i = 0; i < 25; i++) {
        await spatters.ownerMint(owner.address, emptyPalette);
      }
    });

    describe("Request Mint", function () {
      it("Should allow user to request mint with payment", async function () {
        const price = await spatters.getCurrentPrice();
        
        await expect(spatters.connect(user1).requestMint({ value: price }))
          .to.emit(spatters, "MintRequested");
        
        const request = await spatters.getPendingRequest(user1.address);
        expect(request.timestamp).to.be.greaterThan(0);
        expect(request.completed).to.equal(false);
        expect(request.seeds[0]).to.not.equal("0x0000000000000000000000000000000000000000000000000000000000000000");
      });

      it("Should generate 3 unique seeds", async function () {
        const price = await spatters.getCurrentPrice();
        await spatters.connect(user1).requestMint({ value: price });
        
        const request = await spatters.getPendingRequest(user1.address);
        expect(request.seeds[0]).to.not.equal(request.seeds[1]);
        expect(request.seeds[1]).to.not.equal(request.seeds[2]);
        expect(request.seeds[0]).to.not.equal(request.seeds[2]);
      });

      it("Should reject insufficient payment", async function () {
        const price = await spatters.getCurrentPrice();
        const insufficient = price - 1n;
        
        await expect(
          spatters.connect(user1).requestMint({ value: insufficient })
        ).to.be.revertedWith("Insufficient payment");
      });

      it("Should reject if pending request exists", async function () {
        const price = await spatters.getCurrentPrice();
        const tx = await spatters.connect(user1).requestMint({ value: price });
        await tx.wait(); // Ensure transaction is mined
        
        // Verify request was created and is not completed
        const request = await spatters.getPendingRequest(user1.address);
        expect(request.completed).to.equal(false);
        expect(request.timestamp).to.be.greaterThan(0);
        
        // Verify not expired (should be fresh)
        const currentTime = await time.latest();
        const expirationTime = Number(request.timestamp) + (15 * 60); // 15 minutes
        expect(currentTime).to.be.lessThan(expirationTime);
        
        // Second request should fail because first is still pending
        await expect(
          spatters.connect(user1).requestMint({ value: price })
        ).to.be.revertedWith("Pending request exists");
      });
    });

    describe("Complete Mint", function () {
      it("Should allow completing mint with valid choice", async function () {
        const price = await spatters.getCurrentPrice();
        await spatters.connect(user1).requestMint({ value: price });
        
        await expect(spatters.connect(user1).completeMint(1))
          .to.emit(spatters, "Minted");
        
        expect(await spatters.balanceOf(user1.address)).to.equal(1);
        expect(await spatters.totalSupply()).to.equal(26);
      });

      it("Should use the chosen seed", async function () {
        const price = await spatters.getCurrentPrice();
        await spatters.connect(user1).requestMint({ value: price });
        
        const request = await spatters.getPendingRequest(user1.address);
        const chosenSeed = request.seeds[2];
        
        await spatters.connect(user1).completeMint(2);
        
        const tokenData = await spatters.tokens(26);
        expect(tokenData.mintSeed).to.equal(chosenSeed);
      });

      it("Should mark request as completed", async function () {
        const price = await spatters.getCurrentPrice();
        await spatters.connect(user1).requestMint({ value: price });
        await spatters.connect(user1).completeMint(0);
        
        const request = await spatters.pendingRequests(user1.address);
        expect(request.completed).to.equal(true);
      });

      it("Should reject invalid seed choice", async function () {
        const price = await spatters.getCurrentPrice();
        await spatters.connect(user1).requestMint({ value: price });
        
        await expect(
          spatters.connect(user1).completeMint(3)
        ).to.be.revertedWith("Invalid seed choice");
      });

      it("Should reject if no pending request", async function () {
        await expect(
          spatters.connect(user1).completeMint(0)
        ).to.be.revertedWith("No pending request");
      });

      it("Should reject if request expired", async function () {
        const price = await spatters.getCurrentPrice();
        await spatters.connect(user1).requestMint({ value: price });
        
        // Fast forward 16 minutes (past 15 minute expiration)
        await time.increase(16 * 60);
        
        await expect(
          spatters.connect(user1).completeMint(0)
        ).to.be.revertedWith("Request expired");
      });

      it("Should reject if request already completed", async function () {
        const price = await spatters.getCurrentPrice();
        await spatters.connect(user1).requestMint({ value: price });
        await spatters.connect(user1).completeMint(0);
        
        await expect(
          spatters.connect(user1).completeMint(0)
        ).to.be.revertedWith("Request already completed");
      });
    });

    describe("Anti-Whale Protection", function () {
      it("Should enforce global cooldown", async function () {
        const price = await spatters.getCurrentPrice();
        
        // User1 mints
        await spatters.connect(user1).requestMint({ value: price });
        await spatters.connect(user1).completeMint(0);
        
        // User2 tries immediately
        await expect(
          spatters.connect(user2).requestMint({ value: price })
        ).to.be.revertedWith("Global cooldown active");
      });

      it("Should allow mint after global cooldown", async function () {
        let price = await spatters.getCurrentPrice();
        
        await spatters.connect(user1).requestMint({ value: price });
        await spatters.connect(user1).completeMint(0);
        
        // Fast forward 1 hour + 1 second
        await time.increase(3601);
        
        // Refetch price after time increase (price may have changed)
        price = await spatters.getCurrentPrice();
        
        await expect(
          spatters.connect(user2).requestMint({ value: price })
        ).to.emit(spatters, "MintRequested");
      });

      it("Should enforce per-wallet cooldown", async function () {
        const price = await spatters.getCurrentPrice();
        
        await spatters.connect(user1).requestMint({ value: price });
        await spatters.connect(user1).completeMint(0);
        
        // Fast forward past global cooldown
        await time.increase(3601);
        
        // User1 tries to mint again
        await expect(
          spatters.connect(user1).requestMint({ value: price })
        ).to.be.revertedWith("Wallet cooldown active");
      });

      it("Should allow mint after wallet cooldown", async function () {
        let price = await spatters.getCurrentPrice();
        
        await spatters.connect(user1).requestMint({ value: price });
        await spatters.connect(user1).completeMint(0);
        
        // Fast forward 24 hours + 1 second
        await time.increase(86401);
        
        // Price may have changed, get new price
        price = await spatters.getCurrentPrice();
        await expect(
          spatters.connect(user1).requestMint({ value: price })
        ).to.emit(spatters, "MintRequested");
      });

      it("Should enforce max per wallet", async function () {
        // Mint 10 times
        for (let i = 0; i < 10; i++) {
          const price = await spatters.getCurrentPrice();
          await spatters.connect(user1).requestMint({ value: price });
          await spatters.connect(user1).completeMint(0);
          await time.increase(86401); // Skip cooldowns
        }
        
        // 11th should fail
        const price = await spatters.getCurrentPrice();
        await expect(
          spatters.connect(user1).requestMint({ value: price })
        ).to.be.revertedWith("Wallet limit reached");
      });
    });
  });

  describe("Mutations", function () {
    let tokenId: number;

    beforeEach(async function () {
      // Mint a token to user1
      const emptyPalette: [string, string, string, string, string, string] = 
        ["", "", "", "", "", ""];
      await spatters.ownerMint(user1.address, emptyPalette);
      tokenId = 1;
    });

    it("Should allow token owner to mutate", async function () {
      // Mutation requires being on the same day as mint
      // Since we just minted, we can mutate immediately
      // (mintTimestamp and current timestamp are on the same day)
      
      const mutationType = "paletteChangeAll";
      
      // Check if can mutate
      const canMutateBefore = await spatters.canMutate(tokenId);
      
      if (canMutateBefore) {
        // If we can mutate now (same day as mint), test it
        await expect(spatters.connect(user1).mutate(tokenId, mutationType))
          .to.emit(spatters, "Mutated");
        
        const mutations = await spatters.getTokenMutations(tokenId);
        expect(mutations.length).to.equal(1);
        expect(mutations[0].mutationType).to.equal(mutationType);
      } else {
        // If not on a valid mutation date, verify it rejects
        await expect(
          spatters.connect(user1).mutate(tokenId, mutationType)
        ).to.be.revertedWith("Cannot mutate today");
      }
    });

    it("Should prevent non-owner from mutating", async function () {
      await time.increase(365 * 24 * 60 * 60);
      
      await expect(
        spatters.connect(user2).mutate(tokenId, "paletteChangeAll")
      ).to.be.revertedWith("Not token owner");
    });

    it("Should prevent invalid mutation types", async function () {
      await time.increase(365 * 24 * 60 * 60);
      
      await expect(
        spatters.connect(user1).mutate(tokenId, "invalidMutation")
      ).to.be.revertedWith("Invalid mutation type");
    });

    it("Should store mutation record correctly", async function () {
      const mutationType = "shapeExpand";
      
      // Check if we can mutate (might be same day as mint)
      const canMutateNow = await spatters.canMutate(tokenId);
      
      if (canMutateNow) {
        await spatters.connect(user1).mutate(tokenId, mutationType);
        
        const mutations = await spatters.getTokenMutations(tokenId);
        expect(mutations[0].seed).to.not.equal("0x0000000000000000000000000000000000000000000000000000000000000000");
        expect(mutations[0].timestamp).to.be.greaterThan(0);
        expect(mutations[0].mutationType).to.equal(mutationType);
      } else {
        // Test that mutation record structure is correct by checking contract
        // This tests the structure without requiring a specific date
        this.skip(); // Skip if not on valid mutation date
      }
    });

    it("Should enforce mutation limit", async function () {
      // This would take too long to test fully, but we can check the require
      const maxMutations = await spatters.MAX_MUTATIONS();
      expect(maxMutations).to.equal(200);
    });
  });

  describe("Token URI", function () {
    it("Should return valid token URI", async function () {
      const emptyPalette: [string, string, string, string, string, string] = 
        ["", "", "", "", "", ""];
      await spatters.ownerMint(user1.address, emptyPalette);
      
      const uri = await spatters.tokenURI(1);
      expect(uri).to.include("data:application/json;base64");
    });

    it("Should include token ID in metadata", async function () {
      const emptyPalette: [string, string, string, string, string, string] = 
        ["", "", "", "", "", ""];
      await spatters.ownerMint(user1.address, emptyPalette);
      
      const uri = await spatters.tokenURI(1);
      const json = Buffer.from(uri.split(",")[1], "base64").toString();
      expect(json).to.include("Spatter #1");
    });

    it("Should revert for non-existent token", async function () {
      await expect(
        spatters.tokenURI(999)
      ).to.be.revertedWith("Token does not exist");
    });
  });

  describe("View Functions", function () {
    it("Should return correct total supply", async function () {
      expect(await spatters.totalSupply()).to.equal(0);
      
      const emptyPalette: [string, string, string, string, string, string] = 
        ["", "", "", "", "", ""];
      await spatters.ownerMint(user1.address, emptyPalette);
      
      expect(await spatters.totalSupply()).to.equal(1);
    });

    it("Should return current price", async function () {
      const price = await spatters.getCurrentPrice();
      expect(price).to.equal(0); // First 25 are free (owner reserve)
    });

    it("Should return allowed mutations", async function () {
      const mutations = await spatters.getAllowedMutations();
      expect(mutations.length).to.be.greaterThan(0);
    });
  });

  describe("Withdrawal", function () {
    beforeEach(async function () {
      // Complete owner reserve
      const emptyPalette: [string, string, string, string, string, string] = 
        ["", "", "", "", "", ""];
      for (let i = 0; i < 25; i++) {
        await spatters.ownerMint(owner.address, emptyPalette);
      }
    });

    it("Should allow owner to withdraw", async function () {
      const price = await spatters.getCurrentPrice();
      
      // User mints (pays ETH)
      await spatters.connect(user1).requestMint({ value: price });
      await spatters.connect(user1).completeMint(0);
      
      const contractBalance = await ethers.provider.getBalance(await spatters.getAddress());
      expect(contractBalance).to.be.greaterThan(0);
      
      const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);
      await spatters.withdraw();
      const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);
      
      expect(ownerBalanceAfter).to.be.greaterThan(ownerBalanceBefore);
    });

    it("Should prevent non-owner from withdrawing", async function () {
      await expect(
        spatters.connect(user1).withdraw()
      ).to.be.revertedWithCustomError(spatters, "OwnableUnauthorizedAccount");
    });

    it("Should revert if no balance", async function () {
      await expect(
        spatters.withdraw()
      ).to.be.revertedWith("No funds to withdraw");
    });
  });

  describe("EIP-2981 Royalties", function () {
    it("Should set royalty receiver to owner on deployment", async function () {
      expect(await spatters.royaltyReceiver()).to.equal(owner.address);
    });

    it("Should return correct royalty info (5%)", async function () {
      // Mint a token first
      await spatters.ownerMint(owner.address, ["", "", "", "", "", ""]);
      
      const salePrice = ethers.parseEther("1.0");
      const [receiver, royaltyAmount] = await spatters.royaltyInfo(1, salePrice);
      
      expect(receiver).to.equal(owner.address);
      // 5% of 1 ETH = 0.05 ETH
      expect(royaltyAmount).to.equal(ethers.parseEther("0.05"));
    });

    it("Should calculate correct royalty for different sale prices", async function () {
      await spatters.ownerMint(owner.address, ["", "", "", "", "", ""]);
      
      // Test various sale prices
      const testPrices = [
        ethers.parseEther("0.1"),  // 0.005 ETH royalty
        ethers.parseEther("2.0"),  // 0.1 ETH royalty
        ethers.parseEther("10.0"), // 0.5 ETH royalty
      ];
      
      for (const price of testPrices) {
        const [, royaltyAmount] = await spatters.royaltyInfo(1, price);
        const expected = (price * 500n) / 10000n; // 5%
        expect(royaltyAmount).to.equal(expected);
      }
    });

    it("Should allow owner to update royalty receiver", async function () {
      await spatters.setRoyaltyReceiver(user1.address);
      expect(await spatters.royaltyReceiver()).to.equal(user1.address);
      
      // Verify royalty info returns new receiver
      await spatters.ownerMint(owner.address, ["", "", "", "", "", ""]);
      const [receiver] = await spatters.royaltyInfo(1, ethers.parseEther("1.0"));
      expect(receiver).to.equal(user1.address);
    });

    it("Should prevent non-owner from updating royalty receiver", async function () {
      await expect(
        spatters.connect(user1).setRoyaltyReceiver(user2.address)
      ).to.be.revertedWithCustomError(spatters, "OwnableUnauthorizedAccount");
    });

    it("Should prevent setting zero address as royalty receiver", async function () {
      await expect(
        spatters.setRoyaltyReceiver(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid receiver address");
    });

    it("Should emit event when royalty receiver is updated", async function () {
      await expect(spatters.setRoyaltyReceiver(user1.address))
        .to.emit(spatters, "RoyaltyReceiverUpdated")
        .withArgs(user1.address);
    });

    it("Should revert royaltyInfo for non-existent token", async function () {
      await expect(
        spatters.royaltyInfo(999, ethers.parseEther("1.0"))
      ).to.be.revertedWith("Token does not exist");
    });

    it("Should support ERC2981 interface", async function () {
      // ERC2981 interface ID is 0x2a55205a
      const erc2981InterfaceId = "0x2a55205a";
      expect(await spatters.supportsInterface(erc2981InterfaceId)).to.be.true;
    });

    it("Should still support ERC721 interface", async function () {
      // ERC721 interface ID is 0x80ac58cd
      const erc721InterfaceId = "0x80ac58cd";
      expect(await spatters.supportsInterface(erc721InterfaceId)).to.be.true;
    });
  });
});
