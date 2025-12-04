import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("Deploying Spatters NFT Contract (Seed-Based Architecture with SSTORE2)...\n");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // Get account balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH\n");

  // Get network info
  const network = await ethers.provider.getNetwork();
  
  // Load storage addresses from deployment file
  const storageConfigPath = path.join(__dirname, "..", "deployments", `${network.name}-storage.json`);
  
  if (!fs.existsSync(storageConfigPath)) {
    console.error(`❌ Storage config not found: ${storageConfigPath}`);
    console.error(`\nYou must deploy storage contracts first:`);
    console.error(`  npx hardhat run scripts/deploy-storage.ts --network ${network.name}`);
    process.exit(1);
  }
  
  const storageConfig = JSON.parse(fs.readFileSync(storageConfigPath, 'utf8'));
  console.log(`✓ Loaded storage config from: ${storageConfigPath}`);
  console.log(`  Spatters chunks: ${storageConfig.spattersAddresses.length}`);
  console.log(`  P5.js address: ${storageConfig.p5jsAddress || "Using CDN"}\n`);

  // Deploy the contract with storage addresses
  const Spatters = await ethers.getContractFactory("Spatters");
  console.log("Deploying Spatters contract with SSTORE2 addresses...");
  
  const spatters = await Spatters.deploy(
    storageConfig.spattersAddresses,
    storageConfig.p5jsAddress || ethers.ZeroAddress // Use zero address for CDN fallback
  );
  await spatters.waitForDeployment();

  const address = await spatters.getAddress();
  console.log("✅ Spatters deployed to:", address);

  // Verify deployment
  const name = await spatters.name();
  const symbol = await spatters.symbol();
  const maxSupply = await spatters.MAX_SUPPLY();
  const ownerReserve = await spatters.OWNER_RESERVE();
  const maxMutations = await spatters.MAX_MUTATIONS();

  console.log("\nContract Details:");
  console.log("- Name:", name);
  console.log("- Symbol:", symbol);
  console.log("- Max Supply:", maxSupply.toString());
  console.log("- Owner Reserve:", ownerReserve.toString());
  console.log("- Max Mutations Per Token:", maxMutations.toString());
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
  console.log("Storage addresses locked permanently in contract (immutable after construction)");
  console.log("- Spatters.js chunks:", storageConfig.spattersAddresses.length);
  console.log("- p5.js:", storageConfig.p5jsAddress || "CDN (https://cdn.jsdelivr.net/npm/p5@1.11.2/lib/p5.min.js)");

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
  console.log(`   npx hardhat verify --network ${network.name} ${address} "[${storageConfig.spattersAddresses.map((a: string) => `\\"${a}\\"`).join(",")}]" "${storageConfig.p5jsAddress || ethers.ZeroAddress}"`);
  console.log("\n2. Mint owner reserve (up to 25 tokens with optional custom palettes):");
  console.log(`   npx hardhat run scripts/mint-owner-reserve.ts --network ${network.name}`);
  console.log("\n3. Test tokenURI generation:");
  console.log(`   npx hardhat console --network ${network.name}`);
  console.log(`   > const s = await ethers.getContractAt("Spatters", "${address}")`);
  console.log(`   > await s.tokenURI(1) // Copy output and paste in browser`);
  console.log("\n4. Test full minting flow on frontend");
  console.log("5. Verify artwork renders correctly before mainnet launch");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
