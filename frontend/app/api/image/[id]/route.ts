/**
 * Static Image API
 * 
 * Returns a PNG thumbnail of the artwork.
 * This is generated from the pre-computed pixel data.
 * 
 * URL: /api/image/[id]
 * 
 * For OpenSea thumbnails, this loads much faster than rendering live.
 * If PNG doesn't exist, redirects to the interactive viewer.
 */

import { NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
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
    const storage = getStorage();
    const data = await storage.download(tokenId);

    if (!data) {
      // Pixel data not yet generated, redirect to interactive viewer
      return NextResponse.redirect(`${BASE_URL}/api/token/${tokenId}`, 302);
    }

    // Generate PNG from pixel data
    // Note: For production, you may want to cache the PNG separately
    // or pre-generate it when pixels are computed
    
    const { width, height, canvasHistory } = data;
    const latestFrame = canvasHistory[canvasHistory.length - 1];

    // Create PNG using Canvas API (Node.js canvas or browser polyfill needed)
    // For now, we'll return the pixel data URL that can be rendered client-side
    // In production, you'd want to use @napi-rs/canvas or similar
    
    // Temporary: Redirect to interactive viewer
    // TODO: Implement server-side PNG generation with @napi-rs/canvas
    return NextResponse.redirect(`${BASE_URL}/api/token/${tokenId}`, 302);
    
  } catch (error: any) {
    console.error('Error generating image:', error);
    
    // Fallback to interactive viewer
    return NextResponse.redirect(`${BASE_URL}/api/token/${tokenId}`, 302);
  }
}


