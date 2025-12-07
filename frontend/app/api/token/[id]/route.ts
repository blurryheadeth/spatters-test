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
  
  // Check for cache-busting query parameters
  const url = new URL(request.url);
  const mutationCount = url.searchParams.get('m'); // mutation count from parent page
  const manualRefresh = url.searchParams.has('v'); // manual refresh

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

  // Build pixels URL with cache-busting based on mutation count
  // Each unique mutation count = unique URL = fresh fetch
  // Manual refresh adds timestamp to bypass even mutation-count-based cache
  let pixelDataUrl = `/api/pixels/${tokenId}`;
  if (mutationCount !== null) {
    pixelDataUrl += `?m=${mutationCount}`;
    if (manualRefresh) {
      pixelDataUrl += `&v=${Date.now()}`;
    }
  } else if (manualRefresh) {
    pixelDataUrl += `?v=${Date.now()}`;
  }

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
        console.log('[Spatters Debug] Fetching pixel data from:', '${pixelDataUrl}');
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
        
        // DEBUG: Log pixel data info
        console.log('[Spatters Debug] Pixel data loaded:');
        console.log('  - mutationCountFromData:', pixelData.mutationCount);
        console.log('  - canvasHistoryLength:', canvasHistory.length);
        console.log('  - expectedFrames:', (pixelData.mutationCount || 0) + 1);
        console.log('  - pixelDataUrl:', '${pixelDataUrl}');
        console.log('  - generatedAt:', pixelData.generatedAt);
        
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
      
      // Add touch listener with preventDefault to stop mouse emulation
      var el = document.getElementsByTagName("canvas")[0];
      el.addEventListener("touchstart", handleTouch, { passive: false });
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
    let isProcessing = false;
    
    // Single handler for all click/touch events
    function handleInteraction() {
      const now = Date.now();
      
      // Prevent double-firing
      if (isProcessing || now - lastClickTime < 400) return;
      
      isProcessing = true;
      lastClickTime = now;
      
      if (!loaded || canvasHistory.length === 0) {
        isProcessing = false;
        return;
      }
      
      historicalIndex = (historicalIndex + 1) % canvasHistory.length;
      displayFrame(historicalIndex);
      
      // Reset processing flag after a short delay
      setTimeout(function() { isProcessing = false; }, 100);
    }
    
    // p5.js auto-calls this on mouse clicks
    function mouseClicked() {
      handleInteraction();
    }
    
    // Manual touch handler (added in setup)
    function handleTouch(e) {
      e.preventDefault(); // Prevent mouse emulation
      handleInteraction();
    }
  </script>
</body>
</html>`;

  // Cache based on mutation count - if m= param present, can cache longer
  // because URL changes when mutations change
  const shouldCache = mutationCount !== null && !manualRefresh;
  
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': shouldCache
        ? 'public, max-age=86400, stale-while-revalidate=604800' // 1 day, revalidate within 1 week
        : 'no-cache, no-store, must-revalidate',
    },
  });
}


