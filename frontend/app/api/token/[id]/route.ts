/**
 * Lightweight Token Viewer API
 * 
 * Returns an HTML page that displays pre-computed pixel artwork.
 * This loads MUCH faster than generating the artwork from scratch.
 * 
 * URL: /api/token/[id]
 * 
 * Features:
 * - Loads pre-computed pixels from storage (1-3 seconds)
 * - Click to cycle through mutation history
 * - Falls back to "loading" state if pixels not yet computed
 * - Uses p5.js from Art Blocks (on-chain)
 */

import { NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { sepolia, mainnet } from 'viem/chains';

const NETWORK = process.env.NEXT_PUBLIC_NETWORK || 'sepolia';
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

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
  
  // Check for cache-busting query parameter
  const url = new URL(request.url);
  const bustCache = url.searchParams.has('v');

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

  // Use relative URL so it works regardless of host
  // Pass through version param for cache-busting if present
  const versionParam = bustCache ? `?v=${Date.now()}` : '';
  const pixelDataUrl = `/api/pixels/${tokenId}${versionParam}`;

  // Generate minimal viewer HTML - ONLY body margin reset, nothing that interferes with p5.js canvas
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Spatter #${tokenId}</title>
  <style>body{margin:0}</style>
</head>
<body>
  <!-- p5.js from CDN -->
  <script src="https://cdn.jsdelivr.net/npm/p5@1.0.0/lib/p5.min.js"></script>
  
  <script>
    let canvasHistory = [];
    let historicalIndex = 0;
    let canvasWidth = 1200;
    let canvasHeight = 600;
    let loaded = false;

    async function loadPixelData() {
      try {
        const response = await fetch('${pixelDataUrl}');
        if (response.status === 202) {
          setTimeout(loadPixelData, 10000);
          return;
        }
        if (!response.ok) return;
        
        const pixelData = await response.json();
        canvasHistory = pixelData.canvasHistory;
        canvasWidth = pixelData.width;
        canvasHeight = pixelData.height;
        historicalIndex = canvasHistory.length - 1;
        
        // Resize canvas to match pixel data dimensions
        resizeCanvas(canvasWidth, canvasHeight);
        
        loaded = true;
        redraw();
        
        // Notify parent of canvas dimensions for dynamic iframe sizing
        if (window.parent !== window) {
          window.parent.postMessage({
            type: 'spatters-canvas-ready',
            width: canvasWidth,
            height: canvasHeight
          }, '*');
        }
      } catch (e) {
        console.error(e);
      }
    }

    function setup() {
      pixelDensity(1);  // Must be BEFORE createCanvas for retina displays
      createCanvas(canvasWidth, canvasHeight);
      noLoop();
      loadPixelData();
      
      // Add touch listener directly on canvas (matches spatters.js approach)
      // This bypasses p5.js touch handling which can cause double-firing
      var el = document.getElementsByTagName("canvas")[0];
      el.addEventListener("touchstart", mouseClicked, false);
    }

    function displayFrame(index) {
      if (!loaded || !canvasHistory[index]) return;
      loadPixels();
      for (let i = 0; i < canvasHistory[index].length; i++) {
        pixels[i] = canvasHistory[index][i];
      }
      updatePixels();
    }

    function draw() {
      if (loaded) displayFrame(historicalIndex);
    }

    // Debounce to prevent double-firing (touch + emulated mouse events)
    let lastClickTime = 0;
    
    // p5.js auto-calls this on mouse clicks
    // Touch is handled by manual event listener above (like spatters.js)
    // But some browsers/p5.js versions may double-fire, so we debounce
    function mouseClicked() {
      const now = Date.now();
      if (now - lastClickTime < 300) return; // 300ms debounce
      lastClickTime = now;
      
      if (!loaded || canvasHistory.length === 0) return;
      historicalIndex = (historicalIndex + 1) % canvasHistory.length;
      displayFrame(historicalIndex);
    }
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Reduce caching when cache-bust parameter is present
      'Cache-Control': bustCache 
        ? 'no-cache, no-store, must-revalidate'
        : 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}


