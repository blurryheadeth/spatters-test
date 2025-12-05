/**
 * Puppeteer-based pixel generator
 * 
 * Loads the full on-chain HTML, waits for p5.js to render,
 * extracts canvasHistory and PNG screenshot, then uploads to storage.
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import { createPublicClient, http, Address } from 'viem';
import { sepolia, mainnet } from 'viem/chains';
import { createStorage, TokenPixelData } from './storage.js';

// Configuration
const NETWORK = process.env.NETWORK || 'sepolia';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

const chain = NETWORK === 'mainnet' ? mainnet : sepolia;
const rpcUrl = NETWORK === 'mainnet' 
  ? process.env.MAINNET_RPC_URL 
  : process.env.SEPOLIA_RPC_URL;

const publicClient = createPublicClient({
  chain,
  transport: http(rpcUrl),
});

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS as Address;

// Extended result type including PNG
export interface GenerationResult {
  pixelData: TokenPixelData;
  pngBuffer: Buffer;
}

const SPATTERS_ABI = [
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

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });
  }
  return browser;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

/**
 * Generate pixel data, PNG screenshot, and SVG trace for a token
 * 
 * @param tokenId - The token ID to generate for
 * @param fullHtmlUrl - URL to the full on-chain HTML viewer (from existing API)
 * @returns The generated pixel data, PNG buffer, and SVG string
 */
export async function generatePixelData(
  tokenId: number,
  fullHtmlUrl?: string
): Promise<GenerationResult> {
  // Remove trailing slash from base URL and use /api/generate/ path
  // This endpoint serves the FULL on-chain HTML that runs p5.js generation
  const baseUrl = API_BASE_URL.replace(/\/$/, '');
  const url = fullHtmlUrl || `${baseUrl}/api/generate/${tokenId}`;
  
  console.log(`[Token ${tokenId}] Starting generation from ${url}`);
  
  const browser = await getBrowser();
  const page = await browser.newPage();
  
  try {
    // Set viewport to match expected canvas size
    await page.setViewport({ width: 2400, height: 1800 });
    
    // Navigate to the full HTML viewer
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 180000 });
    
    console.log(`[Token ${tokenId}] Page loaded, waiting for canvas generation...`);
    
    // Wait for generation to complete
    // The /api/generate/ endpoint sets generationComplete = true when done
    await page.waitForFunction(
      () => {
        const w = window as any;
        // Check for generationComplete flag (set by /api/generate/ endpoint)
        // OR check if canvasHistory has content (fallback)
        return (w.generationComplete === true) || 
               (w.canvasHistory && 
                w.canvasHistory.length > 0 && 
                w.canvasHistory[0] && 
                w.canvasHistory[0].length > 0);
      },
      { timeout: 180000 } // 3 minute timeout for complex generations
    );
    
    console.log(`[Token ${tokenId}] Canvas generated, extracting pixel data...`);
    
    // Extract canvasHistory and dimensions
    const pixelData = await page.evaluate(() => {
      const w = window as any;
      
      // Get canvas dimensions from p5
      const canvas = document.querySelector('canvas');
      const width = canvas?.width || 1200;
      const height = canvas?.height || 600;
      
      // Check if canvasHistory exists and is valid
      if (!w.canvasHistory) {
        throw new Error('canvasHistory is undefined');
      }
      if (!Array.isArray(w.canvasHistory)) {
        throw new Error('canvasHistory is not an array: ' + typeof w.canvasHistory);
      }
      if (w.canvasHistory.length === 0) {
        throw new Error('canvasHistory is empty');
      }
      
      // Convert to regular arrays for JSON serialization
      // Handle various formats: Uint8ClampedArray, regular arrays, or other typed arrays
      const canvasHistory = w.canvasHistory.map((frame: any, idx: number) => {
        if (!frame) {
          throw new Error(`Frame ${idx} is undefined`);
        }
        // Use Array.from which works on any iterable/array-like
        return Array.from(frame);
      });
      
      return {
        width,
        height,
        canvasHistory,
      };
    });
    
    console.log(`[Token ${tokenId}] Extracted ${pixelData.canvasHistory.length} frames, dimensions: ${pixelData.width}x${pixelData.height}`);
    
    // Take PNG screenshot of final frame (canvas element)
    console.log(`[Token ${tokenId}] Taking PNG screenshot...`);
    const canvasElement = await page.$('canvas');
    let pngBuffer: Buffer;
    if (canvasElement) {
      pngBuffer = await canvasElement.screenshot({ type: 'png' }) as Buffer;
    } else {
      // Fallback to full page screenshot
      pngBuffer = await page.screenshot({ type: 'png' }) as Buffer;
    }
    console.log(`[Token ${tokenId}] PNG captured: ${Math.round(pngBuffer.length / 1024)}KB`);
    
    // Get mutation count from contract
    let mutationCount = 0;
    try {
      const mutations = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: SPATTERS_ABI,
        functionName: 'getTokenMutations',
        args: [BigInt(tokenId)],
      });
      mutationCount = mutations.length;
    } catch (e) {
      console.warn(`[Token ${tokenId}] Could not fetch mutation count:`, e);
    }
    
    const tokenPixelData: TokenPixelData = {
      tokenId,
      width: pixelData.width,
      height: pixelData.height,
      canvasHistory: pixelData.canvasHistory,
      generatedAt: new Date().toISOString(),
      mutationCount,
    };
    
    return {
      pixelData: tokenPixelData,
      pngBuffer,
    };
    
  } finally {
    await page.close();
  }
}

/**
 * Generate and upload pixel data and PNG for a token
 */
export async function generateAndUpload(tokenId: number, fullHtmlUrl?: string): Promise<{
  pixelsUrl: string;
  pngUrl: string;
}> {
  const { pixelData, pngBuffer } = await generatePixelData(tokenId, fullHtmlUrl);
  
  console.log(`[Token ${tokenId}] Uploading to storage...`);
  
  const storage = createStorage();
  
  // Upload pixels and PNG in parallel
  const [pixelsUrl, pngUrl] = await Promise.all([
    storage.upload(tokenId, pixelData),
    storage.uploadPng(tokenId, pngBuffer),
  ]);
  
  console.log(`[Token ${tokenId}] Uploaded pixels to ${pixelsUrl}`);
  console.log(`[Token ${tokenId}] Uploaded PNG to ${pngUrl}`);
  console.log(`[Token ${tokenId}] Pixel data size: ~${Math.round(JSON.stringify(pixelData).length / 1024 / 1024 * 10) / 10}MB uncompressed`);
  
  return { pixelsUrl, pngUrl };
}


