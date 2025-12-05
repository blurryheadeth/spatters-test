/**
 * Pure On-Chain Viewer
 * 
 * This endpoint serves the ACTUAL on-chain HTML template stored in SSTORE2.
 * The only off-chain dependencies are the RPC URLs from the server's env file.
 * 
 * Process:
 * 1. Fetch HTML template from blockchain via getHtmlTemplate()
 * 2. Replace only the placeholder variables with RPC URLs and token ID
 * 3. Serve the resulting HTML exactly as stored on-chain
 * 
 * Use this URL as the canonical "link to original content".
 * 
 * URL: /spatter/[id]
 */

import { NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { sepolia, mainnet } from 'viem/chains';

const NETWORK = process.env.NEXT_PUBLIC_NETWORK || 'sepolia';
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
const GENERATOR_ADDRESS = process.env.NEXT_PUBLIC_GENERATOR_ADDRESS || '0x4159550F0455B0659eAC8eF29Cac7c5a7fD1F506';
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
    name: 'getHtmlTemplate',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'getStorageAddresses',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
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

  // Verify token exists
  try {
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

  try {
    // Fetch the ACTUAL on-chain HTML template
    const htmlTemplate = await publicClient.readContract({
      address: GENERATOR_ADDRESS as `0x${string}`,
      abi: GENERATOR_ABI,
      functionName: 'getHtmlTemplate',
    });

    // Fetch storage addresses for the template
    const storageAddresses = await publicClient.readContract({
      address: GENERATOR_ADDRESS as `0x${string}`,
      abi: GENERATOR_ABI,
      functionName: 'getStorageAddresses',
    });

    // Replace ONLY the placeholders - keep everything else exactly as on-chain
    const html = htmlTemplate
      .replace(/\{\{SEPOLIA_RPC\}\}/g, SEPOLIA_RPC_URL || '')
      .replace(/\{\{MAINNET_RPC\}\}/g, MAINNET_RPC_URL || '')
      .replace(/\{\{TOKEN_ID\}\}/g, tokenId.toString())
      .replace(/\{\{GENERATOR_CONTRACT\}\}/g, GENERATOR_ADDRESS)
      .replace(/\{\{SPATTERS_CONTRACT\}\}/g, CONTRACT_ADDRESS || '')
      .replace(/\{\{STORAGE_ADDRESSES\}\}/g, JSON.stringify(storageAddresses));

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error: any) {
    console.error('Error fetching on-chain template:', error);
    return new NextResponse('Failed to fetch on-chain template: ' + error.message, { status: 500 });
  }
}
