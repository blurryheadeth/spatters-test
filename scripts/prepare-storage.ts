import fs from 'fs';
import path from 'path';

const CHUNK_SIZE = 24000; // 24KB per contract (safe limit under 24576 byte limit)

function chunkFile(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf8');
  const chunks: string[] = [];
  
  for (let i = 0; i < content.length; i += CHUNK_SIZE) {
    chunks.push(content.slice(i, i + CHUNK_SIZE));
  }
  
  return chunks;
}

async function main() {
  console.log('Preparing storage chunks for SSTORE2...\n');
  
  // Create deployments directory if it doesn't exist
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }
  
  // Chunk spatters.js
  const spattersPath = path.join(__dirname, '..', 'original_files', 'spatters.js');
  const spattersChunks = chunkFile(spattersPath);
  
  console.log(`✓ Spatters.js chunked:`);
  console.log(`  - Total size: ${fs.statSync(spattersPath).size} bytes`);
  console.log(`  - Chunk size: ${CHUNK_SIZE} bytes`);
  console.log(`  - Number of chunks: ${spattersChunks.length}`);
  console.log(`  - Estimated gas cost: ~${(spattersChunks.length * 0.02).toFixed(2)} ETH on mainnet`);
  console.log(`  - Estimated gas cost: ~${(spattersChunks.length * 0.001).toFixed(3)} ETH on Sepolia\n`);
  
  // Save chunks
  const outputPath = path.join(__dirname, 'spatters-chunks.json');
  fs.writeFileSync(
    outputPath,
    JSON.stringify({ chunks: spattersChunks }, null, 2)
  );
  
  console.log(`✓ Chunks saved to: ${outputPath}`);
  console.log(`\nReady to deploy storage contracts!`);
  console.log(`Run: npx hardhat run scripts/deploy-storage.ts --network sepolia`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });




