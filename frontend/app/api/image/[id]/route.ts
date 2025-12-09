/**
 * Static Image API - Serves PNG
 * 
 * Returns a PNG thumbnail of the artwork.
 * The PNG is pre-generated and stored in Supabase alongside pixel data.
 * 
 * URL: /api/image/[id]
 * 
 * PNG is widely supported by marketplaces (OpenSea, Etherscan, MetaMask, etc.)
 * Returns a placeholder PNG if not yet generated (wallets don't follow redirects).
 */

import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'spatters-pixels';

// 1x1 transparent PNG placeholder (89 bytes)
// Used when the actual PNG hasn't been generated yet
// This ensures wallets like MetaMask always get image data, not redirects
const PLACEHOLDER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  // Check for cache-busting query parameters
  // m= mutation count makes URL unique per mutation state (safe to cache long)
  // v= manual refresh forces fresh fetch
  const url = new URL(request.url);
  const hasMutationParam = url.searchParams.has('m');
  const hasManualRefresh = url.searchParams.has('v');
  const shouldBypassCache = hasManualRefresh || !hasMutationParam;
  
  // Handle .png extension if present
  const tokenIdStr = id.replace(/\.png$/i, '');
  const tokenId = parseInt(tokenIdStr, 10);

  if (isNaN(tokenId) || tokenId < 1) {
    return NextResponse.json(
      { error: 'Invalid token ID' },
      { status: 400 }
    );
  }

  try {
    // Construct the Supabase storage URL for the PNG
    const pngUrl = `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${tokenId}.png`;
    
    // Fetch the PNG from Supabase (bypass cache if needed)
    const response = await fetch(pngUrl, shouldBypassCache ? { cache: 'no-store' } : undefined);
    
    if (!response.ok) {
      // PNG not yet generated - return placeholder instead of redirect
      // This ensures wallets (MetaMask, etc.) always get actual image data
      console.log(`[Token ${tokenId}] PNG not found, returning placeholder`);
      return new NextResponse(PLACEHOLDER_PNG, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=60', // Short cache - real image will replace soon
        },
      });
    }
    
    const pngBuffer = await response.arrayBuffer();
    
    // Cache strategy:
    // - With ?m= param: URL is unique per mutation count, safe to cache long
    // - With ?v= param: manual refresh, don't cache
    // - No params: short cache (might be stale)
    let cacheControl: string;
    if (hasManualRefresh) {
      cacheControl = 'no-cache, no-store, must-revalidate';
    } else if (hasMutationParam) {
      cacheControl = 'public, max-age=31536000, immutable'; // 1 year - URL unique per state
    } else {
      cacheControl = 'public, max-age=60, s-maxage=300'; // 1 min browser, 5 min CDN
    }
    
    return new NextResponse(pngBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': cacheControl,
      },
    });
    
  } catch (error: any) {
    console.error('Error fetching PNG:', error);
    
    // Return placeholder on error - ensures wallets always get image data
    return new NextResponse(PLACEHOLDER_PNG, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=60',
      },
    });
  }
}
