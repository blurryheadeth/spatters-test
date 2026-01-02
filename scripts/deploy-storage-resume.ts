import { ethers, network } from "hardhat";
import fs from 'fs';
import path from 'path';

/**
 * Resume deploying spatters.js chunks from where we left off.
 * This script handles the ethers.js bug more robustly by:
 * 1. Checking for existing progress
 * 2. Manually waiting for receipts using provider.getTransactionReceipt
 * 3. Saving progress after EVERY successful deployment
 */

function createSSTORE2Bytecode(data: Uint8Array): string {
  const dataWithStop = new Uint8Array([0x00, ...data]);
  const dataLength = dataWithStop.length;
  
  const initCode = [
    0x61, (dataLength >> 8) & 0xff, dataLength & 0xff,
    0x80,
    0x60, 0x0c,
    0x60, 0x00,
    0x39,
    0x60, 0x00,
    0xf3,
  ];
  
  const fullBytecode = new Uint8Array([...initCode, ...dataWithStop]);
  return ethers.hexlify(fullBytecode);
}

async function waitForReceipt(provider: any, txHash: string, maxAttempts = 120): Promise<any> {
  console.log(`   Waiting for receipt...`);
  for (let i = 0; i < maxAttempts; i++) {
    const receipt = await provider.getTransactionReceipt(txHash);
    if (receipt && receipt.contractAddress) {
      return receipt;
    }
    if (i > 0 && i % 12 === 0) {
      console.log(`   Still waiting... (${i * 5}s elapsed)`);
    }
    await new Promise(r => setTimeout(r, 5000));
  }
  throw new Error(`Timeout waiting for receipt: ${txHash}`);
}

async function main() {
  console.log(`\n========================================`);
  console.log(`RESUMING spatters.js chunk deployment on ${network.name}`);
  console.log(`========================================\n`);
  
  const [signer] = await ethers.getSigners();
  console.log(`Account: ${signer.address}`);
  const balance = await ethers.provider.getBalance(signer.address);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH\n`);
  
  // Load chunks
  const chunksPath = path.join(__dirname, 'spatters-chunks.json');
  const { chunks } = JSON.parse(fs.readFileSync(chunksPath, 'utf8'));
  
  // Load progress
  const progressPath = path.join(__dirname, '..', 'deployments', `${network.name}-storage-progress.json`);
  let deployedAddresses: string[] = [];
  let startChunk = 0;
  
  if (fs.existsSync(progressPath)) {
    const progress = JSON.parse(fs.readFileSync(progressPath, 'utf8'));
    deployedAddresses = progress.spattersAddresses || [];
    startChunk = progress.completedChunks || 0;
    console.log(`📂 Found progress: ${startChunk}/${chunks.length} chunks already deployed`);
    deployedAddresses.forEach((addr, i) => {
      console.log(`   Chunk ${i + 1}: ${addr}`);
    });
  }
  
  if (startChunk >= chunks.length) {
    console.log(`\n✅ All chunks already deployed!`);
    return;
  }
  
  console.log(`\n🚀 Deploying chunks ${startChunk + 1} to ${chunks.length}...\n`);
  
  let totalGasUsed = BigInt(0);
  
  for (let i = startChunk; i < chunks.length; i++) {
    const chunkNum = i + 1;
    const chunk = chunks[i];
    
    console.log(`\n--- Deploying chunk ${chunkNum}/${chunks.length} ---`);
    console.log(`Size: ${chunk.length} bytes (~${Math.ceil(chunk.length / 1024)}KB)`);
    
    // Convert and create bytecode
    const data = ethers.toUtf8Bytes(chunk);
    const bytecode = createSSTORE2Bytecode(data);
    
    // Send the transaction
    let txHash: string;
    try {
      const deployTx = await signer.sendTransaction({ data: bytecode });
      txHash = deployTx.hash;
      console.log(`Tx: ${txHash}`);
    } catch (sendError: any) {
      console.error(`❌ Failed to send transaction for chunk ${chunkNum}`);
      console.error(sendError.message);
      throw sendError;
    }
    
    // Wait for receipt using our robust method
    let receipt;
    try {
      receipt = await waitForReceipt(ethers.provider, txHash);
    } catch (waitError: any) {
      console.error(`❌ Failed to get receipt for chunk ${chunkNum}`);
      console.error(`   Tx hash: ${txHash}`);
      console.error(`   Check Etherscan manually and update progress file if successful.`);
      throw waitError;
    }
    
    console.log(`✅ Deployed: ${receipt.contractAddress}`);
    console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
    
    deployedAddresses.push(receipt.contractAddress);
    totalGasUsed += receipt.gasUsed;
    
    // Save progress after EVERY chunk
    fs.writeFileSync(progressPath, JSON.stringify({
      network: network.name,
      timestamp: new Date().toISOString(),
      completedChunks: chunkNum,
      totalChunks: chunks.length,
      spattersAddresses: deployedAddresses,
    }, null, 2));
    console.log(`   Progress saved (${chunkNum}/${chunks.length})`);
  }
  
  console.log(`\n========================================`);
  console.log(`✅ ALL ${chunks.length} CHUNKS DEPLOYED!`);
  console.log(`========================================`);
  console.log(`\nTotal gas used: ${totalGasUsed.toString()}`);
  
  // Save final addresses to mainnet-storage.json
  const outputFile = path.join(__dirname, '..', 'deployments', `${network.name}-storage.json`);
  fs.writeFileSync(outputFile, JSON.stringify({
    network: network.name,
    timestamp: new Date().toISOString(),
    totalGasUsed: totalGasUsed.toString(),
    spattersAddresses: deployedAddresses,
  }, null, 2));
  
  console.log(`\n💾 Final addresses saved to: ${outputFile}`);
  
  console.log(`\n📋 All deployed addresses:`);
  deployedAddresses.forEach((addr, idx) => {
    console.log(`   Chunk ${idx + 1}: ${addr}`);
  });
  
  console.log(`\n📋 Next step:`);
  console.log(`npx hardhat run scripts/deploy-generator-v2.ts --network ${network.name}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(`\n❌ Deployment failed!`);
    console.error(error.message);
    console.error(`\nYou can resume by running this script again.`);
    process.exit(1);
  });

