/**
 * Pixel Status API - Check if pixel data exists and return metadata
 * 
 * Used by the frontend to:
 * 1. Poll for pixel generation completion after mutations
 * 2. Compare cached mutation count with on-chain count to detect stale data
 * 
 * URL: /api/pixel-status/[id]
 * Returns: { exists: boolean, lastModified: string | null, pngExists: boolean, mutationCount: number | null }
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { gunzipSync } from 'zlib';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'spatters-pixels';

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

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return NextResponse.json(
      { error: 'Storage not configured' },
      { status: 500 }
    );
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    // Check for both JSON and PNG files
    const { data: files, error } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .list('', {
        search: `${tokenId}.`,
      });

    if (error) {
      throw error;
    }

    const jsonFile = files?.find(f => f.name === `${tokenId}.json.gz`);
    const pngFile = files?.find(f => f.name === `${tokenId}.png`);

    // Try to get mutation count from cached data
    let cachedMutationCount: number | null = null;
    
    if (jsonFile) {
      try {
        const { data: fileData, error: downloadError } = await supabase.storage
          .from(SUPABASE_BUCKET)
          .download(`${tokenId}.json.gz`);
        
        if (!downloadError && fileData) {
          const buffer = Buffer.from(await fileData.arrayBuffer());
          const decompressed = gunzipSync(buffer);
          const pixelData = JSON.parse(decompressed.toString('utf-8'));
          cachedMutationCount = pixelData.mutationCount ?? null;
        }
      } catch (e) {
        // Failed to get mutation count, leave as null
        console.error('Failed to extract mutation count:', e);
      }
    }

    return NextResponse.json({
      exists: !!jsonFile,
      pngExists: !!pngFile,
      lastModified: jsonFile?.updated_at || jsonFile?.created_at || null,
      pngLastModified: pngFile?.updated_at || pngFile?.created_at || null,
      cachedMutationCount,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });

  } catch (error: any) {
    console.error('Error checking pixel status:', error);
    return NextResponse.json(
      { error: 'Failed to check status' },
      { status: 500 }
    );
  }
}

