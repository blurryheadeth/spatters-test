/**
 * Pixel Status API - Check if pixel data exists and when it was last updated
 * 
 * Used by the frontend to poll for pixel generation completion after mutations.
 * 
 * URL: /api/pixel-status/[id]
 * Returns: { exists: boolean, lastModified: string | null, pngExists: boolean }
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

    return NextResponse.json({
      exists: !!jsonFile,
      pngExists: !!pngFile,
      lastModified: jsonFile?.updated_at || jsonFile?.created_at || null,
      pngLastModified: pngFile?.updated_at || pngFile?.created_at || null,
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

