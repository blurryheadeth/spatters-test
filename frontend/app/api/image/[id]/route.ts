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
    
    // Fetch the PNG from Supabase
    const response = await fetch(pngUrl);
    
    if (!response.ok) {
      // PNG not yet generated, redirect to interactive viewer
      console.log(`[Token ${tokenId}] PNG not found, redirecting to viewer`);
      return NextResponse.redirect(`${BASE_URL}/api/token/${tokenId}`, 302);
    }
    
    const pngBuffer = await response.arrayBuffer();
    
    return new NextResponse(pngBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400', // Browser: 1hr, CDN: 24hr
      },
    });
    
  } catch (error: any) {
    console.error('Error fetching PNG:', error);
    
    // Fallback to interactive viewer
    return NextResponse.redirect(`${BASE_URL}/api/token/${tokenId}`, 302);
  }
}
