import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Update the Spatters contract to reference the new SpattersGeneratorV2 contract.
 * This script reads from the v2 deployment file and updates the Spatters contract.
 */
async function main() {
  const network = await ethers.provider.getNetwork();
  
  // Load deployment files
  const spattersDeploymentPath = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  const generatorV2DeploymentPath = path.join(__dirname, "..", "deployments", `${network.name}-generator-v2.json`);
  
  if (!fs.existsSync(generatorV2DeploymentPath)) {
    throw new Error(
      `Generator V2 deployment not found: ${generatorV2DeploymentPath}\n` +
      `Please run deploy-generator-v2.ts first!`
    );
  }
  
  const spattersDeployment = JSON.parse(fs.readFileSync(spattersDeploymentPath, 'utf8'));
  const generatorV2Deployment = JSON.parse(fs.readFileSync(generatorV2DeploymentPath, 'utf8'));
  
  console.log("\n⚖️ Updating Generator Reference on Spatters Contract");
  console.log("================================================\n");
  console.log("Spatters contract:", spattersDeployment.address);
  console.log("Old Generator (V1):", generatorV2Deployment.spattersAddress ? "See mainnet-generator.json" : "N/A");
  console.log("New Generator (V2):", generatorV2Deployment.generatorAddress);
  console.log("");
  
  const spatters = await ethers.getContractAt("Spatters", spattersDeployment.address);
  
  // Check if generator is already locked
  const isLocked = await spatters.generatorLocked();
  if (isLocked) {
    console.error("❌ ERROR: Generator reference is already locked!");
    console.error("   Cannot update to V2. The generator was permanently locked.");
    process.exit(1);
  }
  
  // Get current generator for reference
  const currentGenerator = await spatters.generatorContract();
  console.log("Current generator on Spatters:", currentGenerator);
  
  if (currentGenerator.toLowerCase() === generatorV2Deployment.generatorAddress.toLowerCase()) {
    console.log("✅ Generator is already set to V2. No update needed.");
    process.exit(0);
  }
  
  console.log("\n📝 Sending transaction to update generator reference...");
  const tx = await spatters.setGeneratorContract(generatorV2Deployment.generatorAddress);
  console.log("Transaction hash:", tx.hash);
  
  console.log("⏳ Waiting for confirmation...");
  await tx.wait();
  console.log("✅ Transaction confirmed!");
  
  // Verify the update
  const newGenerator = await spatters.generatorContract();
  console.log("\n🔍 Verification:");
  console.log("   Stored generator address:", newGenerator);
  
  if (newGenerator.toLowerCase() === generatorV2Deployment.generatorAddress.toLowerCase()) {
    console.log("   ✅ Generator reference successfully updated to V2!");
  } else {
    console.error("   ❌ ERROR: Generator address mismatch!");
    process.exit(1);
  }
  
  console.log("\n📋 Next Steps:");
  console.log("1. Verify the V2 contract on Etherscan");
  console.log("2. Test that everything still works (API, frontend, etc.)");
  console.log("3. (Optional) Call lockGenerator() to permanently lock the reference");
  console.log("   WARNING: This is IRREVERSIBLE - only do this after thorough testing!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

