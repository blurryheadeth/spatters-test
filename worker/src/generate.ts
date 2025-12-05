/**
 * CLI tool for generating pixel data
 * 
 * Usage:
 *   npm run generate -- --token 1
 *   npm run generate -- --token 1,2,3
 *   npm run generate -- --all --max 25
 */

import 'dotenv/config';
import { generateAndUpload, closeBrowser } from './generator.js';

async function main() {
  const args = process.argv.slice(2);
  
  let tokenIds: number[] = [];
  
  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--token' && args[i + 1]) {
      tokenIds = args[i + 1].split(',').map(id => parseInt(id.trim(), 10));
      i++;
    }
    if (args[i] === '--all') {
      // Generate for all tokens (1 to max)
      const max = parseInt(args[i + 2] || '25', 10);
      tokenIds = Array.from({ length: max }, (_, i) => i + 1);
    }
  }

  if (tokenIds.length === 0) {
    console.log('Usage:');
    console.log('  npm run generate -- --token 1');
    console.log('  npm run generate -- --token 1,2,3');
    console.log('  npm run generate -- --all --max 25');
    process.exit(1);
  }

  console.log(`Generating pixel data for tokens: ${tokenIds.join(', ')}`);
  console.log(`Network: ${process.env.NETWORK || 'sepolia'}`);
  console.log(`Storage: ${process.env.STORAGE_PROVIDER || 'supabase'}`);
  console.log('---');

  const results: Array<{ tokenId: number; success: boolean; urls?: { pixelsUrl: string; pngUrl: string; svgUrl: string }; error?: string }> = [];

  for (const tokenId of tokenIds) {
    console.log(`\n[Token ${tokenId}] Starting...`);
    
    try {
      const urls = await generateAndUpload(tokenId);
      results.push({ tokenId, success: true, urls });
      console.log(`[Token ${tokenId}] ✅ Success`);
    } catch (error: any) {
      results.push({ tokenId, success: false, error: error.message });
      console.error(`[Token ${tokenId}] ❌ Failed: ${error.message}`);
    }
  }

  await closeBrowser();

  // Summary
  console.log('\n---');
  console.log('Summary:');
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`  ✅ Successful: ${successful.length}`);
  console.log(`  ❌ Failed: ${failed.length}`);
  
  if (failed.length > 0) {
    console.log('\nFailed tokens:');
    for (const r of failed) {
      console.log(`  - Token ${r.tokenId}: ${r.error}`);
    }
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});


