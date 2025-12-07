/**
 * Pixel Data API
 * 
 * Serves pre-computed pixel data for a token.
 * Acts as a proxy to the storage provider (Supabase or R2).
 * 
 * URL: /api/pixels/[id]
 * 
 * Returns gzip-compressed JSON with canvasHistory array.
 * The lightweight viewer fetches this to display artwork instantly.
 */

import { NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tokenId = parseInt(id, 10);
  
  // Check for cache-busting query parameters
  // m= mutation count makes URL unique per mutation state (safe to cache long)
  // v= manual refresh forces fresh fetch
  const url = new URL(request.url);
  const hasMutationParam = url.searchParams.has('m');
  const hasManualRefresh = url.searchParams.has('v');

  if (isNaN(tokenId) || tokenId < 1) {
    return NextResponse.json(
      { error: 'Invalid token ID' },
      { status: 400 }
    );
  }

  try {
    const storage = getStorage();
    const data = await storage.download(tokenId);

    if (!data) {
      // Pixel data not yet generated
      return NextResponse.json(
        { 
          error: 'Pixel data not yet generated',
          message: 'This token\'s pixel data is still being computed. Please try again in a few minutes.',
          tokenId,
        },
        { 
          status: 202,
          headers: {
            'Retry-After': '60',
          },
        }
      );
    }

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
      cacheControl = 'public, max-age=60, stale-while-revalidate=300'; // 1 min, revalidate 5 min
    }
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': cacheControl,
        'Content-Type': 'application/json',
      },
    });
  } catch (error: any) {
    console.error('Error fetching pixel data:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch pixel data' },
      { status: 500 }
    );
  }
}


