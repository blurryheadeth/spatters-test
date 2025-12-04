/**
 * Full On-Chain Generation Viewer
 * 
 * This endpoint serves the FULL on-chain HTML that actually generates
 * the artwork using p5.js and spatters.js from the blockchain.
 * 
 * Used by the worker/GitHub Actions to generate pixel data.
 * 
 * URL: /api/generate/[id]
 */

import { NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { sepolia, mainnet } from 'viem/chains';

const NETWORK = process.env.NEXT_PUBLIC_NETWORK || 'sepolia';
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
const GENERATOR_ADDRESS = process.env.NEXT_PUBLIC_GENERATOR_ADDRESS || '0x9A0836db227A902575ba904610d2D533AaD7AB56';
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL;
const MAINNET_RPC_URL = process.env.MAINNET_RPC_URL;

const chain = NETWORK === 'mainnet' ? mainnet : sepolia;
const rpcUrl = NETWORK === 'mainnet' ? MAINNET_RPC_URL : SEPOLIA_RPC_URL;

const publicClient = createPublicClient({
  chain,
  transport: http(rpcUrl),
});

const GENERATOR_ABI = [
  {
    name: 'getStorageAddresses',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
  },
  {
    name: 'readStorageChunk',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'storageAddress', type: 'address' }],
    outputs: [{ name: '', type: 'bytes' }],
  },
  {
    name: 'getTokenData',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      { name: 'seed', type: 'bytes32' },
      { name: 'mutationSeeds', type: 'bytes32[]' },
      { name: 'mutationTypes', type: 'string[]' },
      { name: 'customPalette', type: 'string[6]' },
    ],
  },
] as const;

const SPATTERS_ABI = [
  {
    name: 'ownerOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tokenId = parseInt(id, 10);

  if (isNaN(tokenId) || tokenId < 1) {
    return new NextResponse('Invalid token ID', { status: 400 });
  }

  try {
    // Verify token exists
    await publicClient.readContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: SPATTERS_ABI,
      functionName: 'ownerOf',
      args: [BigInt(tokenId)],
    });
  } catch (error: any) {
    if (error.message?.includes('ERC721NonexistentToken')) {
      return new NextResponse('Token does not exist', { status: 404 });
    }
    console.error('Error verifying token:', error);
  }

  // Fetch on-chain data
  let storageAddresses: readonly `0x${string}`[];
  let tokenData: readonly [string, readonly string[], readonly string[], readonly [string, string, string, string, string, string]];

  try {
    [storageAddresses, tokenData] = await Promise.all([
      publicClient.readContract({
        address: GENERATOR_ADDRESS as `0x${string}`,
        abi: GENERATOR_ABI,
        functionName: 'getStorageAddresses',
      }),
      publicClient.readContract({
        address: GENERATOR_ADDRESS as `0x${string}`,
        abi: GENERATOR_ABI,
        functionName: 'getTokenData',
        args: [BigInt(tokenId)],
      }),
    ]);
  } catch (error: any) {
    console.error('Error fetching on-chain data:', error);
    return new NextResponse('Failed to fetch on-chain data: ' + error.message, { status: 500 });
  }

  // Read spatters.js chunks from SSTORE2
  let spattersScript = '';
  try {
    for (const addr of storageAddresses) {
      const chunk = await publicClient.readContract({
        address: GENERATOR_ADDRESS as `0x${string}`,
        abi: GENERATOR_ABI,
        functionName: 'readStorageChunk',
        args: [addr],
      });
      // Convert bytes to string
      const decoder = new TextDecoder();
      spattersScript += decoder.decode(Buffer.from(chunk.slice(2), 'hex'));
    }
  } catch (error: any) {
    console.error('Error reading spatters.js chunks:', error);
    return new NextResponse('Failed to read spatters.js: ' + error.message, { status: 500 });
  }

  const [seed, mutationSeeds, mutationTypes, customPalette] = tokenData;

  // Convert bytes32 hex seed to truncated decimal (matching on-chain template)
  // Takes first 8 bytes (18 chars including 0x) and converts to decimal
  function hexToSeed(hexString: string): number {
    const truncated = hexString.slice(0, 18);
    return parseInt(truncated, 16);
  }

  // Convert mint seed to decimal
  const mintSeedDecimal = hexToSeed(seed);

  // Format mutations for JavaScript - convert seeds to decimal and pair with types
  const mutationsArray = mutationSeeds.map((mSeed: string, i: number) => [
    hexToSeed(mSeed),
    mutationTypes[i]
  ]);

  // Check if custom palette is set
  const hasCustomPalette = customPalette[0] !== '';
  const paletteArray = hasCustomPalette ? [...customPalette] : [];

  // Build the full HTML with all on-chain data injected
  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Spatter #${tokenId} - Generating</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { 
      width: 100%; 
      height: 100%; 
      overflow: hidden; 
      background: #000;
    }
  </style>
</head>
<body>
  <div id="status" style="position:fixed;top:10px;left:10px;color:#fff;font-family:monospace;z-index:9999;"></div>
  
  <!-- p5.js from CDN for generation -->
  <script src="https://cdn.jsdelivr.net/npm/p5@1.0.0/lib/p5.min.js"></script>
  
  <!-- Inject spatters.js from on-chain -->
  <script>
${spattersScript}
  </script>
  
  <script>
    // Token data from blockchain (seed converted to decimal, matching on-chain template)
    const TOKEN_ID = ${tokenId};
    const MINT_SEED = ${mintSeedDecimal};
    const CUSTOM_PALETTE = ${JSON.stringify(paletteArray)};
    const MUTATIONS = ${JSON.stringify(mutationsArray)};
    
    // Flag to indicate generation is complete (canvasHistory is declared in spatters.js)
    var generationComplete = false;
    
    function updateStatus(msg) {
      const el = document.getElementById('status');
      if (el) el.textContent = msg;
      console.log('[Generation]', msg);
    }
    
    function setup() {
      updateStatus('Starting generation with seed: ' + MINT_SEED);
      
      // Generate the artwork - spatters.js populates canvasHistory
      try {
        generate(MINT_SEED, MUTATIONS, CUSTOM_PALETTE);
        updateStatus('Generation complete! Frames: ' + (typeof canvasHistory !== 'undefined' ? canvasHistory.length : 0));
        generationComplete = true;
      } catch (e) {
        updateStatus('Generation error: ' + e.message);
        console.error('Generation error:', e);
      }
    }
    
    function draw() {
      // spatters.js handles drawing
    }
  </script>
</body>
</html>`;

  return new NextResponse(fullHtml, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store', // Don't cache generation pages
    },
  });
}

