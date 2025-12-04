/**
 * Spatters Pixel Generation Worker
 * 
 * HTTP server that accepts requests to generate pixel data for tokens.
 * Deploy to Fly.io for reliable long-running generation tasks.
 * 
 * Endpoints:
 * - POST /generate/:tokenId - Generate pixels for a specific token
 * - POST /generate/batch - Generate pixels for multiple tokens
 * - GET /health - Health check
 */

import 'dotenv/config';
import express from 'express';
import { generateAndUpload, closeBrowser } from './generator.js';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

// Track ongoing generations to prevent duplicates
const ongoingGenerations = new Map<number, Promise<string>>();

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    env: {
      network: process.env.NETWORK || 'sepolia',
      storage: process.env.STORAGE_PROVIDER || 'supabase',
    },
  });
});

/**
 * Generate pixels for a single token
 */
app.post('/generate/:tokenId', async (req, res) => {
  const tokenId = parseInt(req.params.tokenId, 10);
  
  if (isNaN(tokenId) || tokenId < 1) {
    return res.status(400).json({ error: 'Invalid token ID' });
  }

  // Check if generation is already in progress
  if (ongoingGenerations.has(tokenId)) {
    return res.status(202).json({ 
      message: 'Generation already in progress',
      tokenId,
    });
  }

  // Start generation
  const generationPromise = generateAndUpload(tokenId)
    .finally(() => {
      ongoingGenerations.delete(tokenId);
    });

  ongoingGenerations.set(tokenId, generationPromise);

  // Wait for completion (up to 5 minutes)
  try {
    const url = await generationPromise;
    res.json({
      success: true,
      tokenId,
      url,
    });
  } catch (error: any) {
    console.error(`[Token ${tokenId}] Generation failed:`, error);
    res.status(500).json({
      error: 'Generation failed',
      message: error.message,
      tokenId,
    });
  }
});

/**
 * Generate pixels for multiple tokens (batch)
 */
app.post('/generate/batch', async (req, res) => {
  const { tokenIds } = req.body as { tokenIds: number[] };

  if (!Array.isArray(tokenIds) || tokenIds.length === 0) {
    return res.status(400).json({ error: 'tokenIds array required' });
  }

  if (tokenIds.length > 10) {
    return res.status(400).json({ error: 'Maximum 10 tokens per batch' });
  }

  const results: Array<{ tokenId: number; success: boolean; url?: string; error?: string }> = [];

  // Process sequentially to avoid overwhelming the browser
  for (const tokenId of tokenIds) {
    try {
      const url = await generateAndUpload(tokenId);
      results.push({ tokenId, success: true, url });
    } catch (error: any) {
      console.error(`[Token ${tokenId}] Batch generation failed:`, error);
      results.push({ tokenId, success: false, error: error.message });
    }
  }

  res.json({ results });
});

/**
 * Webhook endpoint for mint/mutate events
 * Called by the frontend when a mint or mutate transaction is confirmed
 */
app.post('/webhook/token-update', async (req, res) => {
  const { tokenId, event } = req.body as { tokenId: number; event: 'mint' | 'mutate' };

  if (!tokenId || !event) {
    return res.status(400).json({ error: 'tokenId and event required' });
  }

  console.log(`[Webhook] Received ${event} event for token ${tokenId}`);

  // Start generation in background
  generateAndUpload(tokenId)
    .then(url => {
      console.log(`[Webhook] Token ${tokenId} generation complete: ${url}`);
    })
    .catch(error => {
      console.error(`[Webhook] Token ${tokenId} generation failed:`, error);
    });

  // Respond immediately
  res.json({ 
    message: 'Generation queued',
    tokenId,
    event,
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down...');
  await closeBrowser();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down...');
  await closeBrowser();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`Spatters Worker listening on port ${PORT}`);
  console.log(`Network: ${process.env.NETWORK || 'sepolia'}`);
  console.log(`Storage: ${process.env.STORAGE_PROVIDER || 'supabase'}`);
});


