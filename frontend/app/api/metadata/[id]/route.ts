/**
 * OpenSea Metadata API
 * 
 * Returns JSON metadata for a token in OpenSea-compatible format.
 * 
 * URL: /api/metadata/[id]
 * 
 * This metadata points to:
 * - image: Pre-rendered static image (fast for thumbnails)
 * - animation_url: Lightweight interactive viewer (loads pre-computed pixels)
 */

import { NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { sepolia, mainnet } from 'viem/chains';

const NETWORK = process.env.NEXT_PUBLIC_NETWORK || 'sepolia';
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
// Remove trailing slash to prevent double slashes in URLs
const BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

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
    name: 'tokens',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      { name: 'mintSeed', type: 'bytes32' },
      { name: 'mintTimestamp', type: 'uint256' },
    ],
  },
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
  {
    name: 'getCustomPalette',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string[6]' }],
  },
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
    return NextResponse.json(
      { error: 'Invalid token ID' },
      { status: 400 }
    );
  }

  try {
    // Verify token exists
    const owner = await publicClient.readContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: SPATTERS_ABI,
      functionName: 'ownerOf',
      args: [BigInt(tokenId)],
    });

    if (!owner) {
      return NextResponse.json(
        { error: 'Token does not exist' },
        { status: 404 }
      );
    }

    // Get token data
    const [tokenData, mutations, customPalette] = await Promise.all([
      publicClient.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: SPATTERS_ABI,
        functionName: 'tokens',
        args: [BigInt(tokenId)],
      }),
      publicClient.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: SPATTERS_ABI,
        functionName: 'getTokenMutations',
        args: [BigInt(tokenId)],
      }),
      publicClient.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: SPATTERS_ABI,
        functionName: 'getCustomPalette',
        args: [BigInt(tokenId)],
      }),
    ]);

    const hasCustomPalette = customPalette[0] !== '';
    const mutationCount = mutations.length;

    // Build OpenSea-compatible metadata
    const metadata = {
      name: `Spatter #${tokenId}`,
      description: 'Fully on-chain generative art with time-based mutations. Click the artwork to cycle through mutation history.',
      image: `${BASE_URL}/api/image/${tokenId}`,
      animation_url: `${BASE_URL}/api/token/${tokenId}`,
      external_url: `${BASE_URL}/api/token/${tokenId}`,
      attributes: [
        {
          trait_type: 'Mutations',
          value: mutationCount,
        },
        {
          trait_type: 'Custom Palette',
          value: hasCustomPalette ? 'Yes' : 'No',
        },
        {
          trait_type: 'Generation',
          value: 'On-Chain',
        },
        {
          display_type: 'date',
          trait_type: 'Minted',
          value: Number(tokenData[1]),
        },
      ],
    };

    // Add mutation history attributes
    if (mutationCount > 0) {
      metadata.attributes.push({
        trait_type: 'Latest Mutation',
        value: mutations[mutations.length - 1].mutationType,
      });
    }

    return NextResponse.json(metadata, {
      headers: {
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error: any) {
    console.error('Error fetching metadata:', error);
    
    if (error.message?.includes('ERC721NonexistentToken')) {
      return NextResponse.json(
        { error: 'Token does not exist' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch metadata' },
      { status: 500 }
    );
  }
}


