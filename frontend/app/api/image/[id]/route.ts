/**
 * Static Image API - Serves SVG
 * 
 * Returns a scalable SVG version of the artwork.
 * The SVG is pre-generated and stored in Supabase alongside pixel data.
 * 
 * URL: /api/image/[id]
 * 
 * For marketplaces and collection grids, SVG scales beautifully at any size.
 * Falls back to interactive viewer if SVG not yet generated.
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
  
  // Handle .svg or .png extension if present
  const tokenIdStr = id.replace(/\.(svg|png)$/i, '');
  const tokenId = parseInt(tokenIdStr, 10);

  if (isNaN(tokenId) || tokenId < 1) {
    return NextResponse.json(
      { error: 'Invalid token ID' },
      { status: 400 }
    );
  }

  try {
    // Construct the Supabase storage URL for the SVG
    const svgUrl = `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${tokenId}.svg`;
    
    // Fetch the SVG from Supabase
    const response = await fetch(svgUrl);
    
    if (!response.ok) {
      // SVG not yet generated, redirect to interactive viewer
      console.log(`[Token ${tokenId}] SVG not found, redirecting to viewer`);
      return NextResponse.redirect(`${BASE_URL}/api/token/${tokenId}`, 302);
    }
    
    const svgContent = await response.text();
    
    return new NextResponse(svgContent, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=31536000, immutable', // Cache for 1 year
      },
    });
    
  } catch (error: any) {
    console.error('Error fetching SVG:', error);
    
    // Fallback to interactive viewer
    return NextResponse.redirect(`${BASE_URL}/api/token/${tokenId}`, 302);
  }
}
