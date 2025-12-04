import { run, network } from "hardhat";
import fs from 'fs';
import path from 'path';

async function main() {
  console.log("Verifying Spatters contract on Sepolia Etherscan...\n");
  
  // Load storage config
  const storageConfigPath = path.join(__dirname, "..", "deployments", `${network.name}-storage.json`);
  const storageConfig = JSON.parse(fs.readFileSync(storageConfigPath, 'utf8'));
  
  // Contract address (from deploy output)
  const contractAddress = "0x228E8bD406CAcbeD0D1f7182C7e2a5dB19dAc961";
  
  console.log("Contract:", contractAddress);
  console.log("Network:", network.name);
  console.log("Storage addresses:", storageConfig.spattersAddresses.length);
  
  try {
    await run("verify:verify", {
      address: contractAddress,
      constructorArguments: [
        storageConfig.spattersAddresses,
        storageConfig.p5jsAddress || "0x0000000000000000000000000000000000000000"
      ]
    });
    
    console.log("\n✅ Contract verified successfully!");
    console.log(`View on Etherscan: https://sepolia.etherscan.io/address/${contractAddress}`);
  } catch (error: any) {
    if (error.message.includes("Already Verified")) {
      console.log("\n✅ Contract already verified!");
      console.log(`View on Etherscan: https://sepolia.etherscan.io/address/${contractAddress}`);
    } else {
      console.error("\n❌ Verification failed:");
      console.error(error);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });




