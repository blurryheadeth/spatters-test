import fs from 'fs';
import path from 'path';

async function main() {
  console.log('Chunking spatters.js for SSTORE2 deployment...\n');
  
  // Read the spatters.js file
  const spattersPath = path.join(__dirname, '..', 'original_files', 'spatters.js');
  const spattersContent = fs.readFileSync(spattersPath, 'utf8');
  
  console.log(`Total size: ${spattersContent.length} bytes`);
  console.log(`Total size: ${(spattersContent.length / 1024).toFixed(2)} KB\n`);
  
  // Chunk size: 23KB to stay under EVM contract size limit (24576 bytes)
  // Need to leave room for SSTORE2 init code (~13 bytes) and STOP opcode
  const CHUNK_SIZE = 23 * 1024; // 23KB
  
  const chunks: string[] = [];
  let offset = 0;
  
  while (offset < spattersContent.length) {
    const chunk = spattersContent.slice(offset, offset + CHUNK_SIZE);
    chunks.push(chunk);
    console.log(`Chunk ${chunks.length}: ${chunk.length} bytes`);
    offset += CHUNK_SIZE;
  }
  
  console.log(`\nTotal chunks: ${chunks.length}\n`);
  
  // Save chunks to JSON
  const outputPath = path.join(__dirname, 'spatters-chunks.json');
  fs.writeFileSync(
    outputPath,
    JSON.stringify({ chunks }, null, 2)
  );
  
  console.log(`✓ Chunks saved to: ${outputPath}`);
  console.log(`\nNext step: Deploy storage contracts`);
  console.log(`Run: npx hardhat run scripts/deploy-storage.ts --network sepolia`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


