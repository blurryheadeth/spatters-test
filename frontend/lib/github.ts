/**
 * GitHub Actions Integration
 * 
 * Triggers pixel generation workflow after mint/mutate events.
 * Uses repository_dispatch to trigger the generate-pixels.yml workflow.
 */

const GITHUB_OWNER = process.env.NEXT_PUBLIC_GITHUB_OWNER || 'blurryheadeth';
const GITHUB_REPO = process.env.NEXT_PUBLIC_GITHUB_REPO || 'spatters';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

interface DispatchPayload {
  event_type: 'token-minted' | 'token-mutated';
  client_payload: {
    token_id: number;
  };
}

/**
 * Trigger pixel generation for a token via GitHub Actions
 * 
 * @param tokenId - The token ID to generate pixels for
 * @param event - The event type ('token-minted' or 'token-mutated')
 * @returns true if dispatch was successful, false otherwise
 */
export async function triggerPixelGeneration(
  tokenId: number,
  event: 'token-minted' | 'token-mutated' = 'token-minted'
): Promise<boolean> {
  if (!GITHUB_TOKEN) {
    console.warn('GITHUB_TOKEN not configured - skipping pixel generation trigger');
    return false;
  }

  const payload: DispatchPayload = {
    event_type: event,
    client_payload: {
      token_id: tokenId,
    },
  };

  try {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    if (response.status === 204) {
      console.log(`Triggered pixel generation for token ${tokenId}`);
      return true;
    }

    console.error(`Failed to trigger pixel generation: ${response.status}`);
    return false;
  } catch (error) {
    console.error('Error triggering pixel generation:', error);
    return false;
  }
}

/**
 * Server-side API route handler for triggering pixel generation
 * Use this from API routes instead of calling triggerPixelGeneration directly from client
 */
export async function handlePixelGenerationTrigger(
  tokenId: number,
  event: 'token-minted' | 'token-mutated'
): Promise<{ success: boolean; message: string }> {
  const success = await triggerPixelGeneration(tokenId, event);
  
  return {
    success,
    message: success 
      ? `Pixel generation triggered for token ${tokenId}`
      : 'Failed to trigger pixel generation',
  };
}

