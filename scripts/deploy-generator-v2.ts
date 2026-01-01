import { ethers, network } from "hardhat";
import fs from "fs";
import path from "path";

/**
 * Deploy SpattersGeneratorV2 contract with:
 * - Reference to Spatters NFT contract
 * - SSTORE2 addresses for spatters.js chunks (reused from existing deployment)
 * - SSTORE2 addresses for HTML template chunks (reused from existing deployment)
 * - On-chain legal terms
 * - Initial Terms of Service URL
 */
async function main() {
  console.log("\n🎨 Deploying SpattersGeneratorV2 to", network.name);
  console.log("================================================\n");

  // Initial Terms of Service URL
  const INITIAL_TERMS_URL = "https://spatters.art/legal/terms";

  // 1. Load the storage configuration (spatters.js chunks)
  const storageConfigPath = path.join(
    __dirname,
    "..",
    "deployments",
    `${network.name}-storage.json`
  );

  if (!fs.existsSync(storageConfigPath)) {
    throw new Error(
      `Storage config not found: ${storageConfigPath}\nPlease run deploy-storage.ts first!`
    );
  }

  const storageConfig = JSON.parse(fs.readFileSync(storageConfigPath, "utf8"));
  const spattersStorageAddresses = storageConfig.spattersAddresses;

  console.log("📦 Using SSTORE2 storage addresses for spatters.js:");
  spattersStorageAddresses.forEach((addr: string, idx: number) => {
    console.log(`   Chunk ${idx + 1}: ${addr}`);
  });

  // 2. Load the HTML template deployment
  const templateConfigPath = path.join(
    __dirname,
    "..",
    "deployments",
    `${network.name}-template.json`
  );

  if (!fs.existsSync(templateConfigPath)) {
    throw new Error(
      `Template config not found: ${templateConfigPath}\nPlease run deploy-html-template.ts first!`
    );
  }

  const templateConfig = JSON.parse(fs.readFileSync(templateConfigPath, "utf8"));
  
  // Support both old format (single templateAddress) and new format (array templateAddresses)
  let htmlTemplateAddresses: string[];
  if (templateConfig.templateAddresses) {
    htmlTemplateAddresses = templateConfig.templateAddresses;
  } else if (templateConfig.templateAddress) {
    // Legacy single address format
    htmlTemplateAddresses = [templateConfig.templateAddress];
  } else {
    throw new Error("Template config missing templateAddress(es)");
  }

  console.log(`\n📄 Using HTML template (${htmlTemplateAddresses.length} chunk(s)):`);
  htmlTemplateAddresses.forEach((addr: string, idx: number) => {
    console.log(`   Chunk ${idx + 1}: ${addr}`);
  });

  // 3. Load the Spatters contract deployment
  const spattersDeploymentPath = path.join(
    __dirname,
    "..",
    "deployments",
    `${network.name}.json`
  );

  if (!fs.existsSync(spattersDeploymentPath)) {
    throw new Error(
      `Spatters deployment not found: ${spattersDeploymentPath}\nPlease deploy Spatters contract first!`
    );
  }

  const spattersDeployment = JSON.parse(
    fs.readFileSync(spattersDeploymentPath, "utf8")
  );
  const spattersAddress = spattersDeployment.address;

  console.log(`\n🎨 Using Spatters contract: ${spattersAddress}`);
  console.log(`\n📜 Initial Terms URL: ${INITIAL_TERMS_URL}`);

  // 4. Deploy the Generator V2
  console.log("\n📝 Deploying SpattersGeneratorV2...\n");

  const SpattersGeneratorV2 = await ethers.getContractFactory(
    "SpattersGeneratorV2"
  );
  const generator = await SpattersGeneratorV2.deploy(
    spattersAddress,
    spattersStorageAddresses,
    htmlTemplateAddresses,
    INITIAL_TERMS_URL
  );

  await generator.waitForDeployment();
  const generatorAddress = await generator.getAddress();

  console.log("✅ SpattersGeneratorV2 deployed to:", generatorAddress);

  // 5. Test that it can read the template
  console.log("\n🧪 Testing template reading...");
  try {
    const template = await generator.getHtmlTemplate();
    console.log(`✅ Successfully read HTML template (${template.length} chars)`);
    
    // Check for required placeholders
    const placeholders = ['{{SEPOLIA_RPC}}', '{{MAINNET_RPC}}', '{{TOKEN_ID}}', '{{STORAGE_ADDRESSES}}'];
    for (const ph of placeholders) {
      if (!template.includes(ph)) {
        console.warn(`⚠️  Warning: Template missing placeholder: ${ph}`);
      } else {
        console.log(`   ✓ Found placeholder: ${ph}`);
      }
    }
    
    // Check for pako (embedded decompression library)
    if (template.includes('pako')) {
      console.log(`   ✓ Found embedded pako.js library`);
    }
    
    // Check for Art Blocks registry address
    if (template.includes('0x37861f95882ACDba2cCD84F5bFc4598e2ECDDdAF')) {
      console.log(`   ✓ Found Art Blocks DependencyRegistry address`);
    }
  } catch (error) {
    console.error("❌ Failed to read template:", error);
  }

  // 6. Test getStorageAddresses
  console.log("\n🧪 Testing storage addresses...");
  try {
    const storageAddresses = await generator.getStorageAddresses();
    console.log(`✅ getStorageAddresses() works`);
    console.log(`   Storage chunks: ${storageAddresses.length}`);
  } catch (error) {
    console.error("❌ Failed to read storage addresses:", error);
  }

  // 7. Test legal functions
  console.log("\n⚖️ Testing legal functions...");
  try {
    const legalNotice = await generator.getLegalNotice();
    console.log(`✅ getLegalNotice() works (${legalNotice.length} chars)`);
    console.log(`   Preview: "${legalNotice.substring(0, 80)}..."`);
    
    const termsURL = await generator.getTermsOfServiceURL();
    console.log(`✅ getTermsOfServiceURL() = "${termsURL}"`);
    
    const contractOwner = await generator.owner();
    console.log(`✅ Contract owner: ${contractOwner}`);
  } catch (error) {
    console.error("❌ Failed to read legal info:", error);
  }

  // 8. Save deployment info
  const deploymentInfo = {
    network: network.name,
    generatorAddress: generatorAddress,
    generatorVersion: "V2",
    spattersAddress: spattersAddress,
    htmlTemplateAddresses: htmlTemplateAddresses,
    storageAddresses: spattersStorageAddresses,
    initialTermsURL: INITIAL_TERMS_URL,
    deployedAt: new Date().toISOString(),
    deployer: (await ethers.getSigners())[0].address,
  };

  // Save as v2 file to not overwrite original
  const generatorDeploymentPath = path.join(
    __dirname,
    "..",
    "deployments",
    `${network.name}-generator-v2.json`
  );

  fs.writeFileSync(
    generatorDeploymentPath,
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log(`\n💾 Deployment info saved to: ${generatorDeploymentPath}`);

  // 9. Display next steps
  console.log("\n✅ DEPLOYMENT COMPLETE!");
  console.log("================================================");
  console.log("\n📋 Next Steps:");
  console.log("1. Update Spatters contract to reference new generator:");
  console.log(`   npx hardhat run scripts/set-generator-v2.ts --network ${network.name}`);
  console.log("");
  console.log("2. Verify on Etherscan:");
  console.log(`   npx hardhat verify --network ${network.name} ${generatorAddress} \\`);
  console.log(`     ${spattersAddress} \\`);
  console.log(`     "[${spattersStorageAddresses.map((a: string) => `\\"${a}\\"`).join(',')}]" \\`);
  console.log(`     "[${htmlTemplateAddresses.map((a: string) => `\\"${a}\\"`).join(',')}]" \\`);
  console.log(`     "${INITIAL_TERMS_URL}"`);
  console.log("");
  console.log("3. (Optional) Lock the generator reference on Spatters contract:");
  console.log(`   Call lockGenerator() on Spatters after confirming everything works`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

