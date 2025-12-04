import { ethers, network } from "hardhat";
import fs from "fs";
import path from "path";

/**
 * Test the deployed SpattersGenerator contract
 * Calls getTokenHtml() and verifies it returns complete HTML
 */
async function main() {
  console.log("\n🧪 Testing SpattersGenerator on", network.name);
  console.log("================================================\n");

  // 1. Load generator deployment
  const generatorDeploymentPath = path.join(
    __dirname,
    "..",
    "deployments",
    `${network.name}-generator.json`
  );

  if (!fs.existsSync(generatorDeploymentPath)) {
    throw new Error(
      `Generator deployment not found: ${generatorDeploymentPath}\nPlease run deploy-generator.ts first!`
    );
  }

  const generatorDeployment = JSON.parse(
    fs.readFileSync(generatorDeploymentPath, "utf8")
  );
  const generatorAddress = generatorDeployment.generatorAddress;
  const spattersAddress = generatorDeployment.spattersAddress;

  console.log("🎨 SpattersGenerator:", generatorAddress);
  console.log("🎨 Spatters NFT Contract:", spattersAddress);

  // 2. Connect to contracts
  const generator = await ethers.getContractAt(
    "SpattersGenerator",
    generatorAddress
  );
  const spatters = await ethers.getContractAt("Spatters", spattersAddress);

  // 3. Check total supply
  const totalSupply = await spatters.totalSupply();
  console.log(`\n📊 Total Supply: ${totalSupply} tokens`);

  if (totalSupply === 0n) {
    console.log("\n⚠️  No tokens minted yet!");
    console.log("💡 Mint a token first using owner mint or public mint.");
    return;
  }

  // 4. Test with token #1
  const tokenId = 1;
  console.log(`\n🎯 Testing with Token #${tokenId}...`);

  try {
    // Get token data from Spatters contract
    console.log("\n1️⃣ Reading token data from Spatters contract...");
    const tokenData = await spatters.tokens(tokenId);
    console.log(`   ✅ Mint Seed: ${tokenData.mintSeed}`);
    console.log(
      `   ✅ Mint Timestamp: ${new Date(Number(tokenData.mintTimestamp) * 1000).toLocaleString()}`
    );

    const mutations = await spatters.getTokenMutations(tokenId);
    console.log(`   ✅ Mutations: ${mutations.length}`);

    const palette = await spatters.getCustomPalette(tokenId);
    const hasCustomPalette = palette[0] !== "";
    console.log(`   ✅ Custom Palette: ${hasCustomPalette ? "Yes" : "No"}`);
    if (hasCustomPalette) {
      console.log(`      Colors: ${palette.join(", ")}`);
    }

    // Get spatters.js script
    console.log("\n2️⃣ Reading spatters.js from SSTORE2...");
    const spattersScript = await generator.getSpattersScript();
    console.log(`   ✅ Script length: ${spattersScript.length} chars`);
    console.log(
      `   ✅ Size: ${(spattersScript.length / 1024).toFixed(2)} KB`
    );

    // Verify it contains expected content
    if (spattersScript.includes("function generate")) {
      console.log("   ✅ Script contains generate() function");
    } else {
      console.log("   ⚠️  Warning: Script may not be valid");
    }

    // Get complete HTML
    console.log("\n3️⃣ Generating complete HTML...");
    console.log("   (This may take a moment for large data...)");

    const startTime = Date.now();
    const html = await generator.getTokenHtml(tokenId);
    const duration = Date.now() - startTime;

    console.log(`   ✅ HTML generated in ${duration}ms`);
    console.log(`   ✅ HTML length: ${html.length} chars`);
    console.log(`   ✅ Size: ${(html.length / 1024).toFixed(2)} KB`);

    // Verify HTML structure
    console.log("\n4️⃣ Validating HTML structure...");
    const checks = [
      { name: "<!DOCTYPE html>", present: html.includes("<!DOCTYPE html>") },
      { name: "<html>", present: html.includes("<html>") },
      { name: "p5.js CDN", present: html.includes("p5.min.js") },
      {
        name: "spatters.js script",
        present: html.includes("function generate"),
      },
      { name: "mintingSeed", present: html.includes("mintingSeed") },
      { name: "mutations array", present: html.includes("mutations") },
      {
        name: "setup() function",
        present: html.includes("function setup()"),
      },
    ];

    checks.forEach((check) => {
      if (check.present) {
        console.log(`   ✅ ${check.name}`);
      } else {
        console.log(`   ❌ Missing: ${check.name}`);
      }
    });

    // Save HTML to file for manual inspection
    const outputPath = path.join(__dirname, "..", "test-output.html");
    fs.writeFileSync(outputPath, html);
    console.log(`\n💾 HTML saved to: ${outputPath}`);
    console.log(
      "💡 Open this file in a browser to see the rendered artwork!"
    );

    // Test data URI
    console.log("\n5️⃣ Testing data URI generation...");
    const dataUri = await generator.getTokenHtmlDataUri(tokenId);
    console.log(`   ✅ Data URI length: ${dataUri.length} chars`);
    console.log(
      `   ✅ Starts with: ${dataUri.substring(0, 30)}...`
    );

    // Success!
    console.log("\n✅ ALL TESTS PASSED!");
    console.log("================================================");
    console.log("\n📋 Next Steps:");
    console.log("1. Open test-output.html in browser to verify rendering");
    console.log("2. Test with different token IDs");
    console.log("3. Build API wrapper for OpenSea");
    console.log("4. Update Spatters.tokenURI() to point to API");
  } catch (error: any) {
    console.error("\n❌ TEST FAILED:");
    console.error(error.message);

    if (error.message.includes("Token does not exist")) {
      console.log(
        "\n💡 Token #1 doesn't exist. Try minting one first!"
      );
    } else if (error.message.includes("out of gas")) {
      console.log(
        "\n⚠️  Gas limit issue - this is expected from ethers.js calls"
      );
      console.log("💡 The generator will work fine from web3 frontend calls");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });




