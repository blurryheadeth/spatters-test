import { ethers, network } from "hardhat";
import fs from 'fs';
import path from 'path';

// ============================================================
// CONFIGURATION - Update these after each successful deployment
// ============================================================
const CHUNK_TO_DEPLOY = 10; // All chunks deployed! This is just for reference.

// All spatters.js chunk addresses (MAINNET)
const DEPLOYED_ADDRESSES: string[] = [
  "0x8e5bcb26f1ad493785fc50997f35e9df57d9c58f", // chunk 1
  "0x59f1133b30759364318f416ec937ede04b00b724", // chunk 2
  "0x7ab4d5973b64bc36248800dade40d334ba5fe46d", // chunk 3
  "0x6abb8445dca6a5ee8506fe67d0a27d310213bbee", // chunk 4
  "0x12ed39cdd2b7233e264e13e33ea4bee1e4ce8a77", // chunk 5
  "0x24af1e1a1fe57fa70d029cbda51c29af34a1d311", // chunk 6
  "0x1d5231d5b27b8342964ad6bca9cab65d0f925856", // chunk 7
  "0x6b69ffaa667d851a81dac9c06c36528e639aed45", // chunk 8
  "0xb0dc5ea620ba6172b16802f07fddb900edadd21d", // chunk 9 ✓ COMPLETE
];
// ============================================================

/**
 * SSTORE2 Write Function
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
  console.log(`Deploying chunk ${CHUNK_TO_DEPLOY} to ${network.name}`);
  console.log(`========================================\n`);
  
  const [signer] = await ethers.getSigners();
  console.log(`Account: ${signer.address}`);
  console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(signer.address))} ETH\n`);
  
  // Load chunks
  const chunksPath = path.join(__dirname, 'spatters-chunks.json');
  const { chunks } = JSON.parse(fs.readFileSync(chunksPath, 'utf8'));
  
  if (CHUNK_TO_DEPLOY < 1 || CHUNK_TO_DEPLOY > chunks.length) {
    console.error(`Invalid chunk number. Must be 1-${chunks.length}`);
    process.exit(1);
  }
  
  const chunkIndex = CHUNK_TO_DEPLOY - 1;
  const chunk = chunks[chunkIndex];
  
  console.log(`Chunk size: ${chunk.length} chars (~${Math.ceil(chunk.length / 1024)}KB)`);
  console.log(`\nSending transaction...`);
  
  // Convert and create bytecode
  const data = ethers.toUtf8Bytes(chunk);
  const bytecode = createSSTORE2Bytecode(data);
  
  // Send the transaction - this WILL work even if it throws after
  const deployTx = await signer.sendTransaction({ data: bytecode });
  
  // Print hash immediately - even if script crashes after this, tx is sent
  console.log(`\n✓ Transaction sent!`);
  console.log(`  Hash: ${deployTx.hash}`);
  console.log(`\n  View on Etherscan: https://${network.name === 'mainnet' ? '' : network.name + '.'}etherscan.io/tx/${deployTx.hash}`);
  console.log(`\n  Waiting for confirmation...`);
  
  // Try to wait - might crash here on mainnet but tx is already sent
  const receipt = await deployTx.wait();
  
  console.log(`\n✓ Deployed!`);
  console.log(`  Contract: ${receipt!.contractAddress}`);
  console.log(`  Gas used: ${receipt!.gasUsed.toString()}`);
  
  console.log(`\n========================================`);
  console.log(`Next steps:`);
  console.log(`1. Add this address to DEPLOYED_ADDRESSES array:`);
  console.log(`   "${receipt!.contractAddress}", // chunk ${CHUNK_TO_DEPLOY}`);
  console.log(`2. Update CHUNK_TO_DEPLOY to ${CHUNK_TO_DEPLOY + 1}`);
  console.log(`3. Run again: npx hardhat run scripts/deploy-storage.ts --network ${network.name}`);
  console.log(`========================================\n`);
  
  // If all chunks deployed, save final config
  if (CHUNK_TO_DEPLOY === chunks.length) {
    const allAddresses = [...DEPLOYED_ADDRESSES, receipt!.contractAddress];
    const deploymentsDir = path.join(__dirname, '..', 'deployments');
    if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir);
    
    fs.writeFileSync(
      path.join(deploymentsDir, `${network.name}-storage.json`),
      JSON.stringify({
        network: network.name,
        timestamp: new Date().toISOString(),
        spattersAddresses: allAddresses,
      }, null, 2)
    );
    console.log(`✓ All chunks deployed! Config saved to deployments/${network.name}-storage.json`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    // Even if we crash, show helpful message
    console.error(`\n⚠️  Script crashed, but transaction may have succeeded!`);
    console.error(`    Check Etherscan for your tx hash above.`);
    console.error(`    If successful, find contract address and add to DEPLOYED_ADDRESSES.\n`);
    console.error(error);
    process.exit(1);
  });
