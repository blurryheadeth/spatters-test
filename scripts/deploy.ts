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

  // Deploy the contract (no constructor args - legal terms set after deployment)
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
  console.log("\nAnti-Whale Protection:");
  console.log("- Global Cooldown:", (Number(globalCooldown) / 3600).toFixed(1), "hours");

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

  // Save to deployments folder (required by deploy-generator-v2.ts)
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  const deploymentInfo = {
    address: address,
    network: network.name,
    deployedAt: new Date().toISOString()
  };
  
  fs.writeFileSync(
    path.join(deploymentsDir, `${network.name}.json`),
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log(`✅ Deployment info saved to deployments/${network.name}.json`);

  console.log("\n⚠️  Save this contract address: ", address);
  console.log("\nNew 3-Step Secure Minting Flow:");
  console.log("  Step 1: commitMint() - Pay fee, record block number");
  console.log("  Step 2: requestMint() - Generate seeds from blockhash (wait 1 block)");
  console.log("  Step 3: completeMint() - Choose from 3 previewed seeds");
  console.log("\nNext steps:");
  console.log("1. Verify contract on Etherscan:");
  console.log(`   npx hardhat verify --network ${network.name} ${address}`);
  console.log("\n2. Set legal terms (from owner wallet via Etherscan or script):");
  console.log(`   setLegalNotice("BY INTERACTING WITH THIS CONTRACT...")`);
  console.log(`   setTermsOfServiceURL("https://spatters.art/legal/all")`);
  console.log("\n3. Deploy new spatters.js chunks:");
  console.log(`   npx hardhat run scripts/deploy-storage-all.ts --network ${network.name}`);
  console.log("\n4. Deploy SpattersGeneratorV2 contract:");
  console.log(`   npx hardhat run scripts/deploy-generator-v2.ts --network ${network.name}`);
  console.log("\n5. Set generatorContract on Spatters:");
  console.log(`   npx hardhat run scripts/set-generator-v2.ts --network ${network.name}`);
  console.log("\n6. Set baseURI for token metadata:");
  console.log(`   Call setBaseURI("https://spatters.art/api/metadata/") from owner wallet`);
  console.log("\n7. Mint owner reserve using 3-step flow");
  console.log("8. Test full minting flow on frontend");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
