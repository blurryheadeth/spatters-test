import { ethers } from "hardhat";

/**
 * Set on-chain script addresses for p5.js and spatters.js
 * These are used by tokenURI() to build the HTML for each NFT
 */
async function main() {
  // Get contract address from frontend config
  const contractAddress = process.env.CONTRACT_ADDRESS;
  if (!contractAddress) {
    throw new Error("CONTRACT_ADDRESS environment variable not set");
  }

  console.log("Setting script addresses for Spatters contract:", contractAddress);

  const [deployer] = await ethers.getSigners();
  console.log("Using account:", deployer.address);

  const Spatters = await ethers.getContractFactory("Spatters");
  const spatters = Spatters.attach(contractAddress);

  const network = await ethers.provider.getNetwork();
  
  // Art Blocks p5.js v1.0.0 addresses
  // Mainnet: 0x32d4be5ee74376e08038d652d4dc26e62c67f436
  // For testnet, you may need to deploy your own or find an existing deployment
  
  let p5jsAddress: string;
  let spattersAddress: string;

  if (network.chainId === 1n) {
    // Mainnet
    p5jsAddress = "0x32d4be5ee74376e08038d652d4dc26e62c67f436"; // Art Blocks p5.js
    spattersAddress = process.env.SPATTERS_SCRIPT_ADDRESS || "";
    
    if (!spattersAddress) {
      throw new Error("SPATTERS_SCRIPT_ADDRESS environment variable not set for mainnet");
    }
  } else if (network.chainId === 11155111n) {
    // Sepolia
    p5jsAddress = process.env.P5JS_SCRIPT_ADDRESS || "";
    spattersAddress = process.env.SPATTERS_SCRIPT_ADDRESS || "";
    
    if (!p5jsAddress || !spattersAddress) {
      throw new Error("P5JS_SCRIPT_ADDRESS and SPATTERS_SCRIPT_ADDRESS environment variables required for testnet");
    }
  } else {
    throw new Error(`Unsupported network: ${network.name}`);
  }

  console.log("\nScript Addresses:");
  console.log("- p5.js:", p5jsAddress);
  console.log("- spatters.js:", spattersAddress);

  // Set the addresses
  console.log("\nSetting script addresses...");
  const tx = await spatters.setScriptAddresses(p5jsAddress, spattersAddress);
  await tx.wait();

  console.log("✅ Script addresses set successfully!");
  
  // Verify
  const storedP5js = await spatters.p5jsScriptAddress();
  const storedSpatters = await spatters.spattersScriptAddress();
  
  console.log("\nVerified addresses:");
  console.log("- p5.js:", storedP5js);
  console.log("- spatters.js:", storedSpatters);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });




