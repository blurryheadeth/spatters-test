import { ethers } from "hardhat";

async function main() {
  console.log("Deploying Spatters NFT Contract...");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // Get account balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  // Deploy the contract
  const Spatters = await ethers.getContractFactory("Spatters");
  console.log("Deploying contract...");
  
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

  // Get first mint price (should be 0 for owner reserve)
  const firstPrice = await spatters.getMintPrice();
  console.log("- First 25 tokens mint price:", ethers.formatEther(firstPrice), "ETH");

  console.log("\n⚠️  Save this contract address for frontend integration!");
  console.log("\nNext steps:");
  console.log("1. Verify contract on Etherscan:");
  console.log(`   npx hardhat verify --network ${process.env.HARDHAT_NETWORK || 'localhost'} ${address}`);
  console.log("2. Update frontend with contract address");
  console.log("3. Mint first 25 tokens as owner");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

