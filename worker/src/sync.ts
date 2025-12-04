/**
 * Sync Script - Daily backup to generate missing pixel data
 * 
 * Checks blockchain for all minted tokens, compares against storage,
 * and generates pixels for any that are missing or outdated.
 * 
 * Usage: npm run sync
 */

import 'dotenv/config';
import { createPublicClient, http, Address } from 'viem';
import { sepolia, mainnet } from 'viem/chains';
import { generateAndUpload, closeBrowser } from './generator.js';
import { createStorage } from './storage.js';

const NETWORK = process.env.NETWORK || 'sepolia';
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS as Address;

const chain = NETWORK === 'mainnet' ? mainnet : sepolia;
const rpcUrl = NETWORK === 'mainnet'
  ? process.env.MAINNET_RPC_URL
  : process.env.SEPOLIA_RPC_URL;

const publicClient = createPublicClient({
  chain,
  transport: http(rpcUrl),
});

const SPATTERS_ABI = [
  {
    name: 'totalSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'getTokenMutations',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{
      name: '',
      type: 'tuple[]',
      components: [
        { name: 'mutationType', type: 'string' },
        { name: 'seed', type: 'bytes32' },
        { name: 'timestamp', type: 'uint256' },
      ],
    }],
  },
] as const;

async function main() {
  console.log('=== Spatters Pixel Sync ===');
  console.log(`Network: ${NETWORK}`);
  console.log(`Contract: ${CONTRACT_ADDRESS}`);
  console.log('');

  // Get total supply from contract
  const totalSupply = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: SPATTERS_ABI,
    functionName: 'totalSupply',
  });

  console.log(`Total tokens minted: ${totalSupply}`);

  if (totalSupply === 0n) {
    console.log('No tokens to sync.');
    return;
  }

  const storage = createStorage();
  const missingTokens: number[] = [];
  const outdatedTokens: number[] = [];

  // Check each token
  for (let tokenId = 1; tokenId <= Number(totalSupply); tokenId++) {
    try {
      // Try to download existing pixel data
      const existing = await storage.download(tokenId);

      if (!existing) {
        console.log(`Token ${tokenId}: Missing`);
        missingTokens.push(tokenId);
        continue;
      }

      // Check if mutations have changed (pixel data might be outdated)
      const mutations = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: SPATTERS_ABI,
        functionName: 'getTokenMutations',
        args: [BigInt(tokenId)],
      });

      if (mutations.length !== existing.mutationCount) {
        console.log(`Token ${tokenId}: Outdated (${existing.mutationCount} -> ${mutations.length} mutations)`);
        outdatedTokens.push(tokenId);
      } else {
        console.log(`Token ${tokenId}: OK`);
      }
    } catch (error: any) {
      console.error(`Token ${tokenId}: Error checking - ${error.message}`);
      missingTokens.push(tokenId);
    }
  }

  console.log('');
  console.log(`Missing: ${missingTokens.length}`);
  console.log(`Outdated: ${outdatedTokens.length}`);

  // Generate missing/outdated pixels
  const toGenerate = [...missingTokens, ...outdatedTokens];

  if (toGenerate.length === 0) {
    console.log('All tokens up to date!');
    return;
  }

  console.log('');
  console.log(`Generating pixels for ${toGenerate.length} token(s)...`);
  console.log('');

  let successful = 0;
  let failed = 0;

  for (const tokenId of toGenerate) {
    try {
      console.log(`[Token ${tokenId}] Generating...`);
      await generateAndUpload(tokenId);
      console.log(`[Token ${tokenId}] Done`);
      successful++;
    } catch (error: any) {
      console.error(`[Token ${tokenId}] Failed: ${error.message}`);
      failed++;
    }
  }

  await closeBrowser();

  console.log('');
  console.log('=== Sync Complete ===');
  console.log(`Successful: ${successful}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

