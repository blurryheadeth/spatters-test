/**
 * Preview Generation API
 * 
 * Generates artwork preview from a seed WITHOUT requiring a token to exist.
 * Used for the 3-option preview selection before minting.
 * 
 * URL: /api/preview?seed=0x...&palette=color1,color2,...
 * 
 * Query params:
 * - seed: bytes32 hex string (required)
 * - palette: comma-separated 6 hex colors (optional)
 */

import { NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { sepolia, mainnet } from 'viem/chains';

const NETWORK = process.env.NEXT_PUBLIC_NETWORK || 'sepolia';
const GENERATOR_ADDRESS = process.env.NEXT_PUBLIC_GENERATOR_ADDRESS || '0x2de2a899313a67bB7753167Fa62dAe9E5FF115fE';
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
] as const;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const seedHex = searchParams.get('seed');
  const paletteParam = searchParams.get('palette');

  // Validate seed
  if (!seedHex || !/^0x[0-9A-Fa-f]{64}$/.test(seedHex)) {
    return new NextResponse('Invalid seed. Must be bytes32 hex (0x + 64 hex chars)', { status: 400 });
  }

  // Parse palette if provided
  let paletteArray: string[] = [];
  if (paletteParam) {
    paletteArray = paletteParam.split(',').map(c => c.trim());
    if (paletteArray.length !== 6) {
      return new NextResponse('Palette must have exactly 6 colors', { status: 400 });
    }
    // Validate hex colors
    for (const color of paletteArray) {
      if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
        return new NextResponse(`Invalid hex color: ${color}`, { status: 400 });
      }
    }
  }

  // Convert seed to decimal (matching on-chain template)
  function hexToSeed(hexString: string): number {
    const truncated = hexString.slice(0, 18);
    return parseInt(truncated, 16);
  }
  const seedDecimal = hexToSeed(seedHex);

  // Fetch spatters.js from chain
  let spattersScript = '';
  try {
    const storageAddresses = await publicClient.readContract({
      address: GENERATOR_ADDRESS as `0x${string}`,
      abi: GENERATOR_ABI,
      functionName: 'getStorageAddresses',
    });

    for (const addr of storageAddresses) {
      const chunk = await publicClient.readContract({
        address: GENERATOR_ADDRESS as `0x${string}`,
        abi: GENERATOR_ABI,
        functionName: 'readStorageChunk',
        args: [addr],
      });
      const decoder = new TextDecoder();
      spattersScript += decoder.decode(Buffer.from(chunk.slice(2), 'hex'));
    }
  } catch (error: any) {
    console.error('Error reading spatters.js:', error);
    return new NextResponse('Failed to read spatters.js: ' + error.message, { status: 500 });
  }

  // Art Blocks config
  const artBlocksRegistry = '0x37861f95882ACDba2cCD84F5bFc4598e2ECDDdAF';
  const p5DependencyBytes32 = '0x703540312e302e30000000000000000000000000000000000000000000000000';
  const p5ChunkCount = 10;

  // Build preview HTML
  const previewHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Spatter Preview</title>
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
  
  <script>
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
      updateStatus('Fetching p5.js from Art Blocks...');
      
      const chunks = [];
      for (let i = 0; i < CONFIG.p5ChunkCount; i++) {
        updateStatus('Fetching p5.js chunk ' + (i + 1) + '/' + CONFIG.p5ChunkCount + '...');
        
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
      
      return await decompressGzip(compressedArray);
    }
    
    // Preview data
    const SEED = ${seedDecimal};
    const PALETTE = ${JSON.stringify(paletteArray)};
    
    var previewComplete = false;
    
    function updateStatus(msg) {
      const el = document.getElementById('status');
      if (el) el.textContent = msg;
      console.log('[Preview]', msg);
    }
    
    window.setup = function() {
      updateStatus('Generating preview with seed: ' + SEED);
      
      try {
        generate(SEED, [], PALETTE);
        window.canvasHistory = canvasHistory;
        updateStatus('Preview complete!');
        previewComplete = true;
        
        // Hide status after a moment
        setTimeout(() => {
          document.getElementById('status').style.display = 'none';
        }, 2000);
      } catch (e) {
        updateStatus('Error: ' + e.message);
        console.error('Preview error:', e);
      }
    };
    
    window.draw = function() {};
    
    async function init() {
      try {
        const p5jsCode = await loadP5jsFromArtBlocks();
        updateStatus('Initializing p5.js...');
        eval(p5jsCode);
      } catch (e) {
        updateStatus('Error: ' + e.message);
        console.error(e);
      }
    }
    
    window.onload = init;
  </script>
</body>
</html>`;

  return new NextResponse(previewHtml, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600', // Cache previews for 1 hour
    },
  });
}

