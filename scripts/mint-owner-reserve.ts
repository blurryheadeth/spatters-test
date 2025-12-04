import { ethers } from "hardhat";

/**
 * Mint owner reserve tokens (first 25) with optional custom palettes
 * Usage: 
 * - Without custom palette: npx hardhat run scripts/mint-owner-reserve.ts --network sepolia
 * - With custom palette: Set CUSTOM_PALETTE env var as comma-separated hex colors
 */
async function main() {
  const contractAddress = process.env.CONTRACT_ADDRESS;
  if (!contractAddress) {
    throw new Error("CONTRACT_ADDRESS environment variable not set");
  }

  console.log("Minting owner reserve tokens...");

  const [owner] = await ethers.getSigners();
  console.log("Minting with owner account:", owner.address);

  const Spatters = await ethers.getContractFactory("Spatters");
  const spatters = Spatters.attach(contractAddress);

  // Check current supply
  const totalSupply = await spatters.totalSupply();
  const ownerReserve = await spatters.OWNER_RESERVE();
  
  console.log("\nCurrent supply:", totalSupply.toString());
  console.log("Owner reserve:", ownerReserve.toString());
  
  if (totalSupply >= ownerReserve) {
    console.log("⚠️  Owner reserve period has ended");
    return;
  }

  // Parse recipient address (defaults to owner)
  const recipient = process.env.MINT_TO || owner.address;
  console.log("Minting to:", recipient);

  // Parse custom palette if provided
  const customPaletteEnv = process.env.CUSTOM_PALETTE;
  let customPalette: [string, string, string, string, string, string];
  
  if (customPaletteEnv) {
    const colors = customPaletteEnv.split(",").map(c => c.trim());
    if (colors.length !== 6) {
      throw new Error("Custom palette must have exactly 6 colors");
    }
    
    // Validate hex colors
    for (const color of colors) {
      if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
        throw new Error(`Invalid hex color: ${color}`);
      }
    }
    
    customPalette = colors as [string, string, string, string, string, string];
    console.log("\nUsing custom palette:");
    customPalette.forEach((color, i) => console.log(`  Color ${i + 1}: ${color}`));
  } else {
    // Empty palette = use default
    customPalette = ["", "", "", "", "", ""];
    console.log("\nUsing default palette");
  }

  // Mint token
  console.log("\nMinting token...");
  const tx = await spatters.ownerMint(recipient, customPalette);
  console.log("Transaction sent:", tx.hash);
  
  const receipt = await tx.wait();
  console.log("✅ Token minted! Gas used:", receipt?.gasUsed.toString());

  // Get the new token ID
  const newSupply = await spatters.totalSupply();
  const tokenId = newSupply;
  
  console.log("\nMinted Token ID:", tokenId.toString());
  
  // Get token data
  const tokenData = await spatters.tokens(tokenId);
  console.log("\nToken Data:");
  console.log("- Mint Seed:", tokenData.mintSeed);
  console.log("- Mint Timestamp:", new Date(Number(tokenData.mintTimestamp) * 1000).toISOString());
  console.log("- Has Custom Palette:", tokenData.customPalette[0] !== "");
  
  if (tokenData.customPalette[0] !== "") {
    console.log("- Custom Palette:");
    tokenData.customPalette.forEach((color: string, i: number) => {
      console.log(`  Color ${i + 1}: ${color}`);
    });
  }

  console.log("\n📝 Next steps:");
  console.log("1. View token on OpenSea (once indexed)");
  console.log("2. Mint more owner reserve tokens (", (ownerReserve - newSupply), "remaining )");
  console.log("3. When ready, open public minting");
  
  console.log("\n💡 To mint with custom palette:");
  console.log('   CUSTOM_PALETTE="#ed0caa,#069133,#DF9849,#EDECF0,#eddcab,#cfa6fc" npx hardhat run scripts/mint-owner-reserve.ts --network sepolia');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
