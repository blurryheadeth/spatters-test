import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const network = await ethers.provider.getNetwork();
  
  // Load deployment files
  const spattersDeploymentPath = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  const generatorDeploymentPath = path.join(__dirname, "..", "deployments", `${network.name}-generator.json`);
  
  const spattersDeployment = JSON.parse(fs.readFileSync(spattersDeploymentPath, 'utf8'));
  const generatorDeployment = JSON.parse(fs.readFileSync(generatorDeploymentPath, 'utf8'));
  
  console.log("Setting generator contract address on Spatters...");
  console.log("Spatters contract:", spattersDeployment.address);
  console.log("Generator contract:", generatorDeployment.generatorAddress);
  
  const spatters = await ethers.getContractAt("Spatters", spattersDeployment.address);
  
  const tx = await spatters.setGeneratorContract(generatorDeployment.generatorAddress);
  console.log("Transaction hash:", tx.hash);
  
  await tx.wait();
  console.log("✅ Generator contract address updated on Spatters!");
  
  // Verify
  const storedGenerator = await spatters.generatorContract();
  console.log("Stored generator address:", storedGenerator);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

