/**
 * Puppeteer-based pixel generator
 * 
 * Loads the full on-chain HTML, waits for p5.js to render,
 * extracts canvasHistory, and uploads to storage.
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
 * Generate pixel data for a token
 * 
 * @param tokenId - The token ID to generate pixels for
 * @param fullHtmlUrl - URL to the full on-chain HTML viewer (from existing API)
 * @returns The generated pixel data
 */
export async function generatePixelData(
  tokenId: number,
  fullHtmlUrl?: string
): Promise<TokenPixelData> {
  const url = fullHtmlUrl || `${API_BASE_URL}/token/${tokenId}`;
  
  console.log(`[Token ${tokenId}] Starting generation from ${url}`);
  
  const browser = await getBrowser();
  const page = await browser.newPage();
  
  try {
    // Set viewport to match expected canvas size
    await page.setViewport({ width: 2400, height: 1800 });
    
    // Navigate to the full HTML viewer
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 180000 });
    
    console.log(`[Token ${tokenId}] Page loaded, waiting for canvas generation...`);
    
    // Wait for canvasHistory to be populated
    // This is the key - we wait for the slow p5.js generation to complete
    await page.waitForFunction(
      () => {
        // Check if canvasHistory exists and has content
        const w = window as any;
        return w.canvasHistory && 
               w.canvasHistory.length > 0 && 
               w.canvasHistory[0] && 
               w.canvasHistory[0].length > 0;
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
      
      // Convert Uint8ClampedArray to regular arrays for JSON serialization
      const canvasHistory = w.canvasHistory.map((frame: Uint8ClampedArray | number[]) => 
        Array.from(frame)
      );
      
      return {
        width,
        height,
        canvasHistory,
      };
    });
    
    console.log(`[Token ${tokenId}] Extracted ${pixelData.canvasHistory.length} frames, dimensions: ${pixelData.width}x${pixelData.height}`);
    
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
    
    const result: TokenPixelData = {
      tokenId,
      width: pixelData.width,
      height: pixelData.height,
      canvasHistory: pixelData.canvasHistory,
      generatedAt: new Date().toISOString(),
      mutationCount,
    };
    
    return result;
    
  } finally {
    await page.close();
  }
}

/**
 * Generate and upload pixel data for a token
 */
export async function generateAndUpload(tokenId: number, fullHtmlUrl?: string): Promise<string> {
  const pixelData = await generatePixelData(tokenId, fullHtmlUrl);
  
  console.log(`[Token ${tokenId}] Uploading to storage...`);
  
  const storage = createStorage();
  const url = await storage.upload(tokenId, pixelData);
  
  console.log(`[Token ${tokenId}] Uploaded to ${url}`);
  console.log(`[Token ${tokenId}] Data size: ~${Math.round(JSON.stringify(pixelData).length / 1024 / 1024 * 10) / 10}MB uncompressed`);
  
  return url;
}


