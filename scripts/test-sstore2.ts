import { ethers } from "hardhat";

async function main() {
  console.log("Testing SSTORE2 integration...\n");
  
  const contractAddress = "0x228E8bD406CAcbeD0D1f7182C7e2a5dB19dAc961";
  const spatters = await ethers.getContractAt("Spatters", contractAddress);
  
  console.log("Contract:", contractAddress);
  console.log("Current supply:", (await spatters.totalSupply()).toString());
  
  // Mint a test token (owner mint, no custom palette)
  console.log("\n1. Minting test token...");
  const [signer] = await ethers.getSigners();
  const emptyPalette: [string, string, string, string, string, string] = ["", "", "", "", "", ""];
  
  const tx = await spatters.ownerMint(signer.address, emptyPalette);
  console.log("  Transaction:", tx.hash);
  await tx.wait();
  console.log("  ✓ Token minted!");
  
  // Get token URI
  console.log("\n2. Getting tokenURI...");
  const tokenId = 1;
  const uri = await spatters.tokenURI(tokenId);
  
  console.log("\n3. TokenURI Retrieved:");
  console.log("-".repeat(80));
  
  // Decode the data URI
  if (uri.startsWith("data:application/json;base64,")) {
    const base64Data = uri.slice("data:application/json;base64,".length);
    const jsonString = Buffer.from(base64Data, 'base64').toString('utf8');
    const metadata = JSON.parse(jsonString);
    
    console.log("Name:", metadata.name);
    console.log("Description:", metadata.description);
    console.log("\nAnimation URL (HTML):");
    console.log(metadata.animation_url.slice(0, 200) + "...");
    
    // Decode HTML
    if (metadata.animation_url.startsWith("data:text/html;base64,")) {
      const htmlBase64 = metadata.animation_url.slice("data:text/html;base64,".length);
      const html = Buffer.from(htmlBase64, 'base64').toString('utf8');
      
      console.log("\n4. HTML Content Analysis:");
      console.log("  - Total size:", html.length, "bytes");
      console.log("  - Contains p5.js CDN:", html.includes("cdn.jsdelivr.net/npm/p5") ? "✓" : "✗");
      console.log("  - Contains spatters code:", html.includes("function generate") ? "✓" : "✗");
      console.log("  - Contains mintingSeed:", html.includes("mintingSeed") ? "✓" : "✗");
      console.log("  - Contains hexToSeed:", html.includes("hexToSeed") ? "✓" : "✗");
      
      // Check for spatters.js content
      const hasPalette = html.includes("originalPalette");
      const hasGenerate = html.includes("function generate");
      const hasMutate = html.includes("function mutate");
      
      console.log("\n5. Spatters.js Functions Present:");
      console.log("  - originalPalette:", hasPalette ? "✓" : "✗");
      console.log("  - generate():", hasGenerate ? "✓" : "✗");
      console.log("  - mutate():", hasMutate ? "✓" : "✗");
      
      if (hasPalette && hasGenerate && hasMutate) {
        console.log("\n✅ SSTORE2 storage working perfectly!");
        console.log("   All spatters.js code successfully loaded from on-chain storage!");
      } else {
        console.log("\n❌ WARNING: Some expected code not found");
      }
      
      console.log("\n6. Test in Browser:");
      console.log("   Copy this data URI and paste in browser address bar:");
      console.log("   " + metadata.animation_url.slice(0, 150) + "...");
      
    }
  }
  
  console.log("\n" + "=".repeat(80));
  console.log("✅ SSTORE2 Test Complete!");
  console.log("=".repeat(80));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });




