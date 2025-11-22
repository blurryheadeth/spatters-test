import { ethers } from "hardhat";

async function main() {
  console.log("Testing Exponential Pricing Curve\n");

  // Deploy contract for testing
  const Spatters = await ethers.getContractFactory("Spatters");
  const spatters = await Spatters.deploy();
  await spatters.waitForDeployment();

  console.log("Contract deployed for testing\n");

  // Test prices at key positions
  const testPositions = [1, 25, 26, 30, 50, 75, 100, 333, 666, 950, 999];
  
  console.log("Token # | Price (ETH) | Price (Wei)");
  console.log("--------|-------------|-------------");

  for (const position of testPositions) {
    // Simulate minting up to this position
    const [owner] = await ethers.getSigners();
    const currentSupply = await spatters.totalSupply();
    
    // Mint tokens up to position - 1 if needed
    if (currentSupply < position - 1n) {
      const tokensToMint = Number(position - 1n - currentSupply);
      for (let i = 0; i < tokensToMint; i++) {
        if (currentSupply + BigInt(i) < 25n) {
          // Owner mint
          await spatters.ownerMint(owner.address, "{}");
        } else {
          // Public mint
          const price = await spatters.getMintPrice();
          await spatters.mint("{}", { value: price });
        }
      }
    }

    // Get price for this position
    const price = await spatters.getMintPrice();
    const priceInEth = ethers.formatEther(price);
    
    console.log(`${position.toString().padStart(7, ' ')} | ${priceInEth.padStart(11, ' ')} | ${price.toString()}`);
  }

  console.log("\n✅ Pricing test complete!");
  
  // Verify target prices
  console.log("\nTarget Verification:");
  console.log("- Token #26 should be ~0.00618 ETH");
  console.log("- Token #999 should be ~100 ETH");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


