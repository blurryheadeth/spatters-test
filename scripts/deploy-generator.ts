import { ethers, network } from "hardhat";
import fs from "fs";
import path from "path";

/**
 * Deploy SpattersGenerator contract with:
 * - Reference to Spatters NFT contract
 * - SSTORE2 addresses for spatters.js chunks
 * - SSTORE2 addresses for HTML template chunks
 */
async function main() {
  console.log("\n🎨 Deploying SpattersGenerator to", network.name);
  console.log("================================================\n");

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

  // 4. Deploy the Generator
  console.log("\n📝 Deploying SpattersGenerator...\n");

  const SpattersGenerator = await ethers.getContractFactory(
    "SpattersGenerator"
  );
  const generator = await SpattersGenerator.deploy(
    spattersAddress,
    spattersStorageAddresses,
    htmlTemplateAddresses
  );

  await generator.waitForDeployment();
  const generatorAddress = await generator.getAddress();

  console.log("✅ SpattersGenerator deployed to:", generatorAddress);

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

  // 6. Test getTemplateConfig
  console.log("\n🧪 Testing template config...");
  try {
    const config = await generator.getTemplateConfig();
    console.log(`✅ getTemplateConfig() works`);
    console.log(`   Spatters: ${config[0]}`);
    console.log(`   Generator: ${config[1]}`);
    console.log(`   Storage chunks: ${config[2].length}`);
    console.log(`   Template chunks: ${config[3].length}`);
  } catch (error) {
    console.error("❌ Failed to read config:", error);
  }

  // 7. Save deployment info
  const deploymentInfo = {
    network: network.name,
    generatorAddress: generatorAddress,
    spattersAddress: spattersAddress,
    htmlTemplateAddresses: htmlTemplateAddresses,
    storageAddresses: spattersStorageAddresses,
    deployedAt: new Date().toISOString(),
    deployer: (await ethers.getSigners())[0].address,
  };

  const generatorDeploymentPath = path.join(
    __dirname,
    "..",
    "deployments",
    `${network.name}-generator.json`
  );

  fs.writeFileSync(
    generatorDeploymentPath,
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log(`\n💾 Deployment info saved to: ${generatorDeploymentPath}`);

  // 8. Display next steps
  console.log("\n✅ DEPLOYMENT COMPLETE!");
  console.log("================================================");
  console.log("\n📋 Next Steps:");
  console.log("1. Update API server with new generator address");
  console.log("2. Restart API server and test /token/:id endpoint");
  console.log("3. Verify on Etherscan:");
  console.log(`   npx hardhat verify --network ${network.name} ${generatorAddress} \\`);
  console.log(`     ${spattersAddress} \\`);
  console.log(`     "[${spattersStorageAddresses.map((a: string) => `\\"${a}\\"`).join(',')}]" \\`);
  console.log(`     "[${htmlTemplateAddresses.map((a: string) => `\\"${a}\\"`).join(',')}]"`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
