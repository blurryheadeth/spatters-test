import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * SSTORE2 Write Function
 * Creates a contract where the bytecode IS the data (prefixed with STOP opcode).
 */
function createSSTORE2Bytecode(data: Uint8Array): string {
  // The data will be stored as runtime code, prefixed with 0x00 (STOP opcode)
  const dataWithStop = new Uint8Array([0x00, ...data]);
  const dataLength = dataWithStop.length;
  
  // Init code (12 bytes total):
  // PUSH2 size (3) + DUP1 (1) + PUSH1 offset (2) + PUSH1 dest (2) + CODECOPY (1) + PUSH1 retoff (2) + RETURN (1) = 12
  const initCode = [
    0x61, (dataLength >> 8) & 0xff, dataLength & 0xff, // PUSH2 dataLength (3 bytes)
    0x80, // DUP1 (1 byte)
    0x60, 0x0c, // PUSH1 12 - offset where data starts (2 bytes)
    0x60, 0x00, // PUSH1 0 - dest in memory (2 bytes)
    0x39, // CODECOPY (1 byte)
    0x60, 0x00, // PUSH1 0 - return offset (2 bytes)
    0xf3, // RETURN (1 byte)
  ];
  
  // Combine init code + data
  const fullBytecode = new Uint8Array([...initCode, ...dataWithStop]);
  
  return ethers.hexlify(fullBytecode);
}

/**
 * Split data into chunks for SSTORE2 deployment
 * @param data The full data as Uint8Array
 * @param maxChunkSize Maximum size per chunk (default ~24KB)
 * @returns Array of chunks
 */
function splitIntoChunks(data: Uint8Array, maxChunkSize: number = 24000): Uint8Array[] {
  const chunks: Uint8Array[] = [];
  let offset = 0;
  
  while (offset < data.length) {
    const remaining = data.length - offset;
    const chunkSize = Math.min(remaining, maxChunkSize);
    chunks.push(data.slice(offset, offset + chunkSize));
    offset += chunkSize;
  }
  
  return chunks;
}

/**
 * Deploy HTML template to SSTORE2
 * Supports multi-chunk deployment for templates larger than ~24KB
 */
async function main() {
  console.log("🚀 Deploying HTML template to SSTORE2...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH\n");

  // Read the HTML template
  const templatePath = path.join(__dirname, "../templates/viewer.html");
  const template = fs.readFileSync(templatePath, "utf8");
  
  console.log("📄 Template size:", template.length, "bytes");
  console.log("   (~", (template.length / 1024).toFixed(2), "KB)\n");

  // Convert string to bytes
  const templateBytes = ethers.toUtf8Bytes(template);
  
  // Split into chunks if needed
  const MAX_CHUNK_SIZE = 24000; // ~24KB per contract
  const chunks = splitIntoChunks(new Uint8Array(templateBytes), MAX_CHUNK_SIZE);
  
  console.log(`📦 Splitting template into ${chunks.length} chunk(s)...`);
  chunks.forEach((chunk, i) => {
    console.log(`   Chunk ${i + 1}: ${chunk.length} bytes`);
  });
  console.log();

  // Deploy each chunk
  const templateAddresses: string[] = [];
  
  for (let i = 0; i < chunks.length; i++) {
    console.log(`\n📦 Deploying chunk ${i + 1}/${chunks.length}...`);
    
    const bytecode = createSSTORE2Bytecode(chunks[i]);
    console.log(`   Bytecode size: ${bytecode.length / 2} bytes (hex)`);
    
    const tx = await deployer.sendTransaction({
      data: bytecode,
    });
    
    console.log(`   Tx hash: ${tx.hash}`);
    
    const receipt = await tx.wait();
    const address = receipt?.contractAddress;
    
    if (!address) {
      throw new Error(`Failed to get contract address for chunk ${i + 1}`);
    }
    
    templateAddresses.push(address);
    console.log(`   ✅ Deployed to: ${address}`);
    console.log(`   Gas used: ${receipt?.gasUsed.toString()}`);
    
    // Verify deployment
    const deployedCode = await ethers.provider.getCode(address);
    const deployedSize = (deployedCode.length - 2) / 2;
    console.log(`   Deployed bytecode size: ${deployedSize} bytes`);
  }

  console.log("\n✅ All template chunks deployed!");
  console.log("Template addresses:", templateAddresses);

  // Save deployment info
  const deploymentInfo = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    templateAddresses,
    templateChunks: chunks.length,
    templateSize: template.length,
    deployedAt: new Date().toISOString(),
  };

  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const outputPath = path.join(deploymentsDir, `${network.name}-template.json`);
  fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));
  
  console.log("\n📁 Deployment info saved to:", outputPath);
  console.log("\n✨ HTML Template deployment complete!");
  console.log("\nNext steps:");
  console.log("1. Run: npx hardhat run scripts/deploy-generator.ts --network", network.name);
  console.log("2. Update API server with new generator address");
  console.log("3. Test /token/:id endpoint");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
