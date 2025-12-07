/**
 * Static Image API - Serves PNG
 * 
 * Returns a PNG thumbnail of the artwork.
 * The PNG is pre-generated and stored in Supabase alongside pixel data.
 * 
 * URL: /api/image/[id]
 * 
 * PNG is widely supported by marketplaces (OpenSea, Etherscan, etc.)
 * Falls back to interactive viewer if PNG not yet generated.
 */

import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'spatters-pixels';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

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
      // PNG not yet generated, redirect to interactive viewer
      console.log(`[Token ${tokenId}] PNG not found, redirecting to viewer`);
      const redirectUrl = hasMutationParam 
        ? `${BASE_URL}/api/token/${tokenId}?m=${url.searchParams.get('m')}`
        : `${BASE_URL}/api/token/${tokenId}`;
      return NextResponse.redirect(redirectUrl, 302);
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
    
    // Fallback to interactive viewer
    return NextResponse.redirect(`${BASE_URL}/api/token/${tokenId}`, 302);
  }
}
