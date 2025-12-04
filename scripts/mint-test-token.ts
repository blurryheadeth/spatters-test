import { ethers, network } from "hardhat";
import fs from "fs";
import path from "path";

/**
 * Mint a test token for generator testing
 */
async function main() {
  console.log("\n🎨 Minting test token on", network.name);
  console.log("================================================\n");

  // Load deployment
  const deploymentPath = path.join(
    __dirname,
    "..",
    "deployments",
    `${network.name}.json`
  );
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const spattersAddress = deployment.address;

  const spatters = await ethers.getContractAt("Spatters", spattersAddress);
  const [owner] = await ethers.getSigners();

  console.log("🎨 Spatters:", spattersAddress);
  console.log("👤 Owner:", owner.address);

  // Mint without custom palette
  console.log("\n📝 Minting test token...");
  const tx = await spatters.ownerMint(
    owner.address,
    ["", "", "", "", "", ""] // Empty strings for no custom palette
  );
  await tx.wait();

  const totalSupply = await spatters.totalSupply();
  console.log(`✅ Token #${totalSupply} minted!`);

  // Get token data
  const tokenData = await spatters.tokens(totalSupply);
  console.log(`\n📊 Token Data:`);
  console.log(`   Mint Seed: ${tokenData.mintSeed}`);
  console.log(`   Timestamp: ${new Date(Number(tokenData.mintTimestamp) * 1000).toLocaleString()}`);

  console.log("\n✅ Ready to test generator!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

