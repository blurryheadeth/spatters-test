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
  
  // Check for cache-busting query parameter
  const url = new URL(request.url);
  const bustCache = url.searchParams.has('v');

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

    return NextResponse.json(data, {
      headers: {
        // Reduce caching when cache-bust parameter is present
        'Cache-Control': bustCache 
          ? 'no-cache, no-store, must-revalidate'
          : 'public, max-age=31536000, immutable',
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


