import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
  const deploymentPath = "./deployments/sepolia.json";
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  
  const baseURI = "https://spatters-frontend.vercel.app/api/metadata/";
  
  console.log("Setting baseURI on Spatters...");
  console.log("Spatters contract:", deployment.address);
  console.log("BaseURI:", baseURI);
  
  const spatters = await ethers.getContractAt("Spatters", deployment.address);
  
  const tx = await spatters.setBaseURI(baseURI);
  console.log("Transaction hash:", tx.hash);
  await tx.wait();
  
  const storedURI = await spatters.baseURI();
  console.log("✅ BaseURI set successfully!");
  console.log("Stored baseURI:", storedURI);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

