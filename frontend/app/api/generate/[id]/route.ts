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
const GENERATOR_ADDRESS = process.env.NEXT_PUBLIC_GENERATOR_ADDRESS || '0xFad64bbc5b685eEF10bBCc27d82777A90047127c';
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

  // Parse optional width parameter (1200-8400, default 1200)
  const { searchParams } = new URL(request.url);
  const widthParam = searchParams.get('width');
  const requestedWidth = widthParam ? parseInt(widthParam, 10) : 1200;
  const canvasWidth = isNaN(requestedWidth) ? 1200 : Math.max(1200, Math.min(8400, requestedWidth));

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
    const truncated = hexString.slice(0, 10);
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

  // Art Blocks config for p5.js loading
  const artBlocksRegistry = '0x37861f95882ACDba2cCD84F5bFc4598e2ECDDdAF';
  const p5DependencyBytes32 = '0x703540312e302e30000000000000000000000000000000000000000000000000';
  const p5ChunkCount = 10;

  // Build the full HTML with all on-chain data injected
  // This matches the on-chain template behavior - loads p5.js from Art Blocks
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
      min-height: 100%; 
      background: #000;
    }
  </style>
</head>
<body>
  <div id="status" style="position:fixed;top:10px;left:10px;color:#fff;font-family:monospace;z-index:9999;background:rgba(0,0,0,0.7);padding:5px 10px;border-radius:4px;"></div>
  
  <!-- Inject spatters.js from on-chain -->
  <script>
${spattersScript}
  </script>
  
  <!-- Override canvas width if custom value requested -->
  <script>
    setupVariables.canvasWidth = ${canvasWidth};
  </script>
  
  <script>
    // ============================================================
    // ART BLOCKS P5.JS LOADING (Matching on-chain template)
    // ============================================================
    
    const CONFIG = {
      mainnetRpc: '${MAINNET_RPC_URL}',
      artBlocksRegistry: '${artBlocksRegistry}',
      p5DependencyBytes32: '${p5DependencyBytes32}',
      p5ChunkCount: ${p5ChunkCount}
    };
    
    async function ethCall(rpcUrl, to, data) {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_call',
          params: [{ to, data }, 'latest'],
          id: Date.now()
        })
      });
      const json = await response.json();
      if (json.error) throw new Error(json.error.message);
      return json.result;
    }
    
    function encodeUint256(num) {
      return num.toString(16).padStart(64, '0');
    }
    
    function hexToString(hex) {
      if (!hex || hex === '0x') return '';
      if (hex.startsWith('0x')) hex = hex.slice(2);
      let str = '';
      for (let i = 0; i < hex.length; i += 2) {
        const code = parseInt(hex.substr(i, 2), 16);
        if (code === 0) continue;
        str += String.fromCharCode(code);
      }
      return str;
    }
    
    function decodeAbiString(hex) {
      if (hex.startsWith('0x')) hex = hex.slice(2);
      const offset = parseInt(hex.slice(0, 64), 16) * 2;
      const length = parseInt(hex.slice(offset, offset + 64), 16);
      const data = hex.slice(offset + 64, offset + 64 + length * 2);
      return hexToString('0x' + data);
    }
    
    async function decompressGzip(compressedData) {
      const ds = new DecompressionStream('gzip');
      const blob = new Blob([compressedData]);
      const decompressedStream = blob.stream().pipeThrough(ds);
      return await new Response(decompressedStream).text();
    }
    
    const GET_DEPENDENCY_SCRIPT_SELECTOR = '0x518cb3df';
    
    async function loadP5jsFromArtBlocks() {
      updateStatus('Fetching p5.js from Art Blocks (Ethereum Mainnet)...');
      
      const chunks = [];
      for (let i = 0; i < CONFIG.p5ChunkCount; i++) {
        updateStatus('Fetching p5.js chunk ' + (i + 1) + '/' + CONFIG.p5ChunkCount + ' from Art Blocks...');
        
        const indexHex = encodeUint256(i);
        const callData = GET_DEPENDENCY_SCRIPT_SELECTOR + 
                         CONFIG.p5DependencyBytes32.slice(2) + 
                         indexHex;
        
        const result = await ethCall(CONFIG.mainnetRpc, CONFIG.artBlocksRegistry, callData);
        const chunk = decodeAbiString(result);
        chunks.push(chunk);
      }
      
      const compressedBase64 = chunks.join('');
      
      updateStatus('Decompressing p5.js...');
      const compressedBinary = atob(compressedBase64);
      const compressedArray = new Uint8Array(compressedBinary.length);
      for (let i = 0; i < compressedBinary.length; i++) {
        compressedArray[i] = compressedBinary.charCodeAt(i);
      }
      
      const decompressed = await decompressGzip(compressedArray);
      return decompressed;
    }
    
    // ============================================================
    // GENERATION LOGIC
    // ============================================================
    
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
    
    // Define setup before p5.js loads (p5.js will call this)
    window.setup = function() {
      updateStatus('Starting generation with seed: ' + MINT_SEED);
      
      try {
        generate(MINT_SEED, MUTATIONS, CUSTOM_PALETTE);
        
        // Expose canvasHistory to window for Puppeteer extraction
        window.canvasHistory = canvasHistory;
        
        // Hide status text so it doesn't appear in screenshots/SVG traces
        document.getElementById('status').style.display = 'none';
        generationComplete = true;
      } catch (e) {
        updateStatus('Generation error: ' + e.message);
        console.error('Generation error:', e);
      }
    };
    
    window.draw = function() {
      // spatters.js handles drawing
    };
    
    // Load p5.js from Art Blocks and execute
    async function init() {
      try {
        const p5jsCode = await loadP5jsFromArtBlocks();
        updateStatus('Initializing p5.js...');
        eval(p5jsCode);
      } catch (e) {
        updateStatus('Error loading p5.js: ' + e.message);
        console.error('Error loading p5.js:', e);
      }
    }
    
    window.onload = init;
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

