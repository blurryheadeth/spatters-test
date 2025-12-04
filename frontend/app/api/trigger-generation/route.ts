/**
 * API Route: Trigger Pixel Generation
 * 
 * Called by frontend after mint/mutate to trigger GitHub Actions workflow.
 * 
 * POST /api/trigger-generation
 * Body: { tokenId: number, event: 'token-minted' | 'token-mutated' }
 */

import { NextResponse } from 'next/server';
import { handlePixelGenerationTrigger } from '@/lib/github';

export async function POST(request: Request) {
  try {
    const { tokenId, event } = await request.json();

    if (!tokenId || typeof tokenId !== 'number') {
      return NextResponse.json(
        { error: 'tokenId required' },
        { status: 400 }
      );
    }

    const validEvents = ['token-minted', 'token-mutated'];
    if (!event || !validEvents.includes(event)) {
      return NextResponse.json(
        { error: 'event must be token-minted or token-mutated' },
        { status: 400 }
      );
    }

    const result = await handlePixelGenerationTrigger(tokenId, event);

    return NextResponse.json(result, {
      status: result.success ? 200 : 500,
    });
  } catch (error: any) {
    console.error('Error in trigger-generation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

