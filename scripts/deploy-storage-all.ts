import { ethers, network } from "hardhat";
import fs from 'fs';
import path from 'path';

/**
 * Deploy ALL spatters.js chunks to SSTORE2 storage in one run.
 * This script deploys all chunks sequentially and saves the addresses.
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

async function main() {
  console.log(`\n========================================`);
  console.log(`Deploying ALL spatters.js chunks to ${network.name}`);
  console.log(`========================================\n`);
  
  const [signer] = await ethers.getSigners();
  console.log(`Account: ${signer.address}`);
  const balance = await ethers.provider.getBalance(signer.address);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH\n`);
  
  // Load chunks
  const chunksPath = path.join(__dirname, 'spatters-chunks.json');
  const { chunks } = JSON.parse(fs.readFileSync(chunksPath, 'utf8'));
  
  console.log(`Total chunks to deploy: ${chunks.length}`);
  console.log(`Total script size: ${chunks.reduce((sum: number, c: string) => sum + c.length, 0)} bytes\n`);
  
  const deployedAddresses: string[] = [];
  let totalGasUsed = BigInt(0);
  
  for (let i = 0; i < chunks.length; i++) {
    const chunkNum = i + 1;
    const chunk = chunks[i];
    
    console.log(`\n--- Deploying chunk ${chunkNum}/${chunks.length} ---`);
    console.log(`Size: ${chunk.length} bytes (~${Math.ceil(chunk.length / 1024)}KB)`);
    
    // Convert and create bytecode
    const data = ethers.toUtf8Bytes(chunk);
    const bytecode = createSSTORE2Bytecode(data);
    
    // Send the transaction
    const deployTx = await signer.sendTransaction({ data: bytecode });
    const txHash = deployTx.hash;
    
    console.log(`Tx hash: ${txHash}`);
    console.log(`Waiting for confirmation...`);
    
    // Handle the ethers.js bug where it crashes on empty "to" field for contract deployments
    // We catch any error and manually wait for the receipt using the tx hash
    let receipt;
    try {
      receipt = await deployTx.wait();
    } catch (waitError: any) {
      // If wait() fails (ethers.js bug), get receipt directly from provider
      console.log(`⚠️  wait() threw error (ethers.js bug), fetching receipt manually...`);
      
      // Wait for transaction to be mined
      let attempts = 0;
      while (attempts < 60) { // Wait up to 5 minutes
        receipt = await ethers.provider.getTransactionReceipt(txHash);
        if (receipt) break;
        await new Promise(r => setTimeout(r, 5000)); // Wait 5 seconds
        attempts++;
        console.log(`   Waiting for confirmation... (attempt ${attempts})`);
      }
      
      if (!receipt) {
        console.error(`❌ Could not get receipt for chunk ${chunkNum}`);
        console.error(`   Tx hash: ${txHash}`);
        console.error(`   Check Etherscan and add address manually if successful.`);
        throw new Error(`Failed to confirm chunk ${chunkNum}`);
      }
    }
    
    if (!receipt || !receipt.contractAddress) {
      console.error(`❌ Chunk ${chunkNum} deployment failed - no contract address`);
      console.error(`   Tx hash: ${txHash}`);
      throw new Error(`Chunk ${chunkNum} deployment failed - no contract address`);
    }
    
    console.log(`✅ Deployed: ${receipt.contractAddress}`);
    console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
    
    deployedAddresses.push(receipt.contractAddress);
    totalGasUsed += receipt.gasUsed;
    
    // Save progress after each chunk in case of later failure
    const progressFile = path.join(__dirname, '..', 'deployments', `${network.name}-storage-progress.json`);
    fs.writeFileSync(progressFile, JSON.stringify({
      network: network.name,
      timestamp: new Date().toISOString(),
      completedChunks: chunkNum,
      totalChunks: chunks.length,
      spattersAddresses: deployedAddresses,
    }, null, 2));
    console.log(`   Progress saved (${chunkNum}/${chunks.length} chunks)`);
  }
  
  console.log(`\n========================================`);
  console.log(`✅ ALL ${chunks.length} CHUNKS DEPLOYED!`);
  console.log(`========================================`);
  console.log(`\nTotal gas used: ${totalGasUsed.toString()}`);
  
  // Save to deployments folder
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir);
  
  const outputFile = path.join(deploymentsDir, `${network.name}-storage.json`);
  
  fs.writeFileSync(
    outputFile,
    JSON.stringify({
      network: network.name,
      timestamp: new Date().toISOString(),
      totalGasUsed: totalGasUsed.toString(),
      spattersAddresses: deployedAddresses,
    }, null, 2)
  );
  
  console.log(`\n💾 Saved to: ${outputFile}`);
  
  console.log(`\n📋 Deployed addresses:`);
  deployedAddresses.forEach((addr, idx) => {
    console.log(`   Chunk ${idx + 1}: ${addr}`);
  });
  
  console.log(`\n📋 Next steps:`);
  console.log(`1. Deploy GeneratorV2 (reusing HTML template):`);
  console.log(`   npx hardhat run scripts/deploy-generator-v2.ts --network ${network.name}`);
  console.log(`\n2. Update Spatters contract to use new generator:`);
  console.log(`   Call setGeneratorContract() on Etherscan or run:`);
  console.log(`   npx hardhat run scripts/set-generator-v2.ts --network ${network.name}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(`\n❌ Deployment failed!`);
    console.error(error);
    process.exit(1);
  });

