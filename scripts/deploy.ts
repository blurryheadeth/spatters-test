import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("Deploying Spatters NFT Contract...\n");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // Get account balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH\n");

  // Get network info
  const network = await ethers.provider.getNetwork();

  // Deploy the contract (no constructor arguments - script storage is in SpattersGenerator)
  const Spatters = await ethers.getContractFactory("Spatters");
  console.log("Deploying Spatters contract...");
  
  const spatters = await Spatters.deploy();
  await spatters.waitForDeployment();

  const address = await spatters.getAddress();
  console.log("✅ Spatters deployed to:", address);

  // Verify deployment
  const name = await spatters.name();
  const symbol = await spatters.symbol();
  const maxSupply = await spatters.MAX_SUPPLY();
  const ownerReserve = await spatters.OWNER_RESERVE();

  console.log("\nContract Details:");
  console.log("- Name:", name);
  console.log("- Symbol:", symbol);
  console.log("- Max Supply:", maxSupply.toString());
  console.log("- Owner Reserve:", ownerReserve.toString());
  console.log("- Owner:", await spatters.owner());

  // Get pricing info
  const currentPrice = await spatters.getCurrentPrice();
  console.log("- Current mint price:", ethers.formatEther(currentPrice), "ETH");

  // Get cooldown info
  const globalCooldown = await spatters.GLOBAL_COOLDOWN();
  const walletCooldown = await spatters.WALLET_COOLDOWN();
  const maxPerWallet = await spatters.MAX_PER_WALLET();
  console.log("\nAnti-Whale Protection:");
  console.log("- Global Cooldown:", (Number(globalCooldown) / 3600).toFixed(1), "hours");
  console.log("- Wallet Cooldown:", (Number(walletCooldown) / 3600).toFixed(1), "hours");
  console.log("- Max Per Wallet:", maxPerWallet.toString());

  console.log("\nNetwork:", network.name);
  console.log("Note: Script storage addresses are managed by the SpattersGenerator contract");

  // Save contract address and ABI to frontend
  const frontendContractsDir = path.join(__dirname, "..", "frontend", "contracts");
  if (fs.existsSync(frontendContractsDir)) {
    const contractData = {
      address: address,
      abi: JSON.parse(spatters.interface.formatJson()),
      network: network.name,
      chainId: network.chainId.toString()
    };

    fs.writeFileSync(
      path.join(frontendContractsDir, "Spatters.json"),
      JSON.stringify(contractData, null, 2)
    );
    console.log("\n✅ Contract address and ABI saved to frontend/contracts/Spatters.json");
  }

  console.log("\n⚠️  Save this contract address: ", address);
  console.log("\nNext steps:");
  console.log("1. Verify contract on Etherscan:");
  console.log(`   npx hardhat verify --network ${network.name} ${address}`);
  console.log("\n2. Deploy SpattersGenerator contract (stores script addresses):");
  console.log(`   npx hardhat run scripts/deploy-generator.ts --network ${network.name}`);
  console.log("\n3. Set generatorContract on Spatters:");
  console.log(`   npx hardhat run scripts/set-generator.ts --network ${network.name}`);
  console.log("\n4. Mint owner reserve (up to 30 tokens with optional custom palettes):");
  console.log(`   npx hardhat run scripts/mint-owner-reserve.ts --network ${network.name}`);
  console.log("\n5. Set baseURI for token metadata:");
  console.log(`   Call setBaseURI("https://your-domain.com/api/metadata/") from owner wallet`);
  console.log("\n6. Test full minting flow on frontend");
  console.log("7. Verify artwork renders correctly before mainnet launch");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
