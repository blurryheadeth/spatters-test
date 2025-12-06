/**
 * Debug endpoint to verify environment variables
 * DELETE THIS BEFORE MAINNET DEPLOYMENT
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    env: {
      NEXT_PUBLIC_CONTRACT_ADDRESS: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || 'NOT SET',
      NEXT_PUBLIC_SEPOLIA_CONTRACT_ADDRESS: process.env.NEXT_PUBLIC_SEPOLIA_CONTRACT_ADDRESS || 'NOT SET',
      NEXT_PUBLIC_GENERATOR_ADDRESS: process.env.NEXT_PUBLIC_GENERATOR_ADDRESS || 'NOT SET',
      NEXT_PUBLIC_NETWORK: process.env.NEXT_PUBLIC_NETWORK || 'NOT SET',
      NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || 'NOT SET',
      // Don't expose RPC URLs for security, just show if they're set
      SEPOLIA_RPC_URL: process.env.SEPOLIA_RPC_URL ? 'SET' : 'NOT SET',
      MAINNET_RPC_URL: process.env.MAINNET_RPC_URL ? 'SET' : 'NOT SET',
    },
    expected: {
      CONTRACT_ADDRESS: '0x294949BA59348514C65ca48c82E6ADd87696A6Ed',
      GENERATOR_ADDRESS: '0xFad64bbc5b685eEF10bBCc27d82777A90047127c',
    }
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    }
  });
}

