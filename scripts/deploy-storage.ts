import { ethers, network } from "hardhat";
import fs from 'fs';
import path from 'path';

/**
 * SSTORE2 Write Function
 * 
 * Creates a contract where the bytecode IS the data (prefixed with STOP opcode).
 * This matches the solady/SSTORE2 pattern used by Art Blocks.
 * 
 * The init code:
 * 1. Copies the data portion to memory
 * 2. Returns it as the contract's runtime code
 * 
 * After deployment, the contract's bytecode is: 0x00 + data
 * The STOP opcode (0x00) ensures the contract can't be called.
 */
function createSSTORE2Bytecode(data: Uint8Array): string {
  // The data will be stored as runtime code, prefixed with 0x00 (STOP opcode)
  const dataWithStop = new Uint8Array([0x00, ...data]);
  const dataLength = dataWithStop.length;
  
  // Calculate where data starts in the init code
  // Init code length varies based on data length encoding
  let initCode: number[];
  
  // Init code (12 bytes total):
  // PUSH2 size (3) + DUP1 (1) + PUSH1 offset (2) + PUSH1 dest (2) + CODECOPY (1) + PUSH1 retoff (2) + RETURN (1) = 12
  initCode = [
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

async function main() {
  console.log(`\nDeploying SSTORE2 storage contracts to ${network.name}...`);
  const [signer] = await ethers.getSigners();
  console.log(`Using account: ${signer.address}`);
  console.log(`Account balance: ${ethers.formatEther(await ethers.provider.getBalance(signer.address))} ETH\n`);
  
  // Load chunks
  const chunksPath = path.join(__dirname, 'spatters-chunks.json');
  if (!fs.existsSync(chunksPath)) {
    console.error('Error: spatters-chunks.json not found!');
    console.error('Run: npx ts-node scripts/chunk-spatters.ts');
    process.exit(1);
  }
  
  const { chunks } = JSON.parse(fs.readFileSync(chunksPath, 'utf8'));
  
  console.log(`Deploying ${chunks.length} storage contracts...`);
  console.log(`(This will take ~${chunks.length * 15} seconds with transaction confirmations)\n`);
  
  const spattersAddresses: string[] = [];
  let totalGasUsed = 0n;
  
  for (let i = 0; i < chunks.length; i++) {
    const chunkNum = i + 1;
    const chunk = chunks[i];
    
    console.log(`[${chunkNum}/${chunks.length}] Deploying chunk (${chunk.length} chars / ~${Math.ceil(chunk.length / 1024)}KB)...`);
    
    try {
      // Convert string to bytes
      const data = ethers.toUtf8Bytes(chunk);
      
      // Create proper SSTORE2 init code
      const bytecode = createSSTORE2Bytecode(data);
      
      // Deploy the SSTORE2 contract
      const deployTx = await signer.sendTransaction({
        data: bytecode
      });
      
      console.log(`  Tx hash: ${deployTx.hash}`);
      
      const receipt = await deployTx.wait();
      
      if (!receipt || !receipt.contractAddress) {
        throw new Error('Failed to get contract address from receipt');
      }
      
      const address = receipt.contractAddress;
      spattersAddresses.push(address);
      totalGasUsed += receipt.gasUsed;
      
      console.log(`  ✓ Deployed to: ${address}`);
      console.log(`  Gas used: ${receipt.gasUsed.toString()}\n`);
      
      // Verify the deployment worked
      const deployedCode = await ethers.provider.getCode(address);
      if (deployedCode.length < 10) {
        throw new Error(`Deployment verification failed - no code at ${address}`);
      }
      console.log(`  Verified: ${(deployedCode.length - 2) / 2} bytes stored\n`);
      
    } catch (error) {
      console.error(`  ✗ Failed to deploy chunk ${chunkNum}:`, error);
      throw error;
    }
  }
  
  // Calculate costs
  const gasPrice = (await ethers.provider.getFeeData()).gasPrice || 0n;
  const totalCost = totalGasUsed * gasPrice;
  const totalCostEth = ethers.formatEther(totalCost);
  
  console.log('─'.repeat(60));
  console.log('✓ All storage contracts deployed!\n');
  console.log(`Total contracts: ${spattersAddresses.length}`);
  console.log(`Total gas used: ${totalGasUsed.toString()}`);
  console.log(`Total cost: ~${totalCostEth} ETH\n`);
  
  // Save addresses
  const storageConfig = {
    network: network.name,
    timestamp: new Date().toISOString(),
    totalGasUsed: totalGasUsed.toString(),
    totalCostEth: totalCostEth,
    spattersAddresses: spattersAddresses,
    p5jsAddress: "" // Using CDN for p5.js
  };
  
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }
  
  const outputPath = path.join(deploymentsDir, `${network.name}-storage.json`);
  fs.writeFileSync(
    outputPath,
    JSON.stringify(storageConfig, null, 2)
  );
  
  console.log(`Storage config saved to: ${outputPath}`);
  console.log(`\nAddresses for API configuration:`);
  console.log(JSON.stringify(spattersAddresses, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
