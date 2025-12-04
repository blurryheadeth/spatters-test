/**
 * Test script for owner minting with customSeed parameter
 */

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Owner address:", deployer.address);
  
  // Get contract address from frontend config
  const frontendConfigPath = path.join(__dirname, "..", "frontend", "contracts", "Spatters.json");
  const frontendConfig = JSON.parse(fs.readFileSync(frontendConfigPath, 'utf8'));
  const contractAddress = frontendConfig.address;
  
  console.log("Contract address:", contractAddress);
  
  const spatters = await ethers.getContractAt("Spatters", contractAddress);
  
  // Check current supply
  const totalSupply = await spatters.totalSupply();
  console.log("Current total supply:", totalSupply.toString());
  
  // Mint with auto-generated seed (customSeed = bytes32(0))
  console.log("\n--- Test 1: Minting with auto-generated seed ---");
  const emptyPalette: [string, string, string, string, string, string] = ['', '', '', '', '', ''];
  const zeroSeed = ethers.ZeroHash;
  
  let tx = await spatters.ownerMint(deployer.address, emptyPalette, zeroSeed);
  let receipt = await tx.wait();
  console.log("✅ Minted token 1 with auto-generated seed");
  console.log("   Gas used:", receipt?.gasUsed.toString());
  
  // Get the minted token's seed
  const token1Data = await spatters.tokens(1);
  console.log("   Seed:", token1Data.mintSeed);
  
  // Mint with custom seed
  console.log("\n--- Test 2: Minting with custom seed ---");
  const customSeed = ethers.keccak256(ethers.toUtf8Bytes("my-custom-artwork-seed-12345"));
  console.log("   Custom seed:", customSeed);
  
  tx = await spatters.ownerMint(deployer.address, emptyPalette, customSeed);
  receipt = await tx.wait();
  console.log("✅ Minted token 2 with custom seed");
  console.log("   Gas used:", receipt?.gasUsed.toString());
  
  const token2Data = await spatters.tokens(2);
  console.log("   Seed:", token2Data.mintSeed);
  console.log("   Seeds match:", token2Data.mintSeed === customSeed);
  
  // Mint with custom palette and custom seed
  console.log("\n--- Test 3: Minting with custom palette + custom seed ---");
  const customPalette: [string, string, string, string, string, string] = [
    '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'
  ];
  const customSeed2 = ethers.keccak256(ethers.toUtf8Bytes("rainbow-artwork-seed"));
  
  tx = await spatters.ownerMint(deployer.address, customPalette, customSeed2);
  receipt = await tx.wait();
  console.log("✅ Minted token 3 with custom palette and custom seed");
  
  const token3Data = await spatters.tokens(3);
  const token3Palette = await spatters.getCustomPalette(3);
  console.log("   Seed:", token3Data.mintSeed);
  console.log("   Palette:", token3Palette);
  
  // Final supply
  const finalSupply = await spatters.totalSupply();
  console.log("\n=== Final total supply:", finalSupply.toString(), "===");
  
  console.log("\n🎉 Test complete! View your tokens at:");
  console.log(`   http://localhost:3000/token/1`);
  console.log(`   http://localhost:3000/token/2`);
  console.log(`   http://localhost:3000/token/3`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

