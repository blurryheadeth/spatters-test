/**
 * HTML Builder for Spatters NFTs
 * 
 * Assembles complete HTML documents from:
 * - spatters.js script (read from SSTORE2)
 * - Token data (seed, mutations, palette)
 * - p5.js CDN reference
 */

// p5.js CDN URL
export const P5JS_CDN = "https://cdn.jsdelivr.net/npm/p5@1.11.2/lib/p5.min.js";

// Token data interface
export interface TokenData {
  seed: `0x${string}`;
  mutationSeeds: readonly `0x${string}`[];
  mutationTypes: readonly string[];
  customPalette: readonly string[];
}

/**
 * Convert bytes32 hex to a JavaScript-safe seed number
 * Takes 13 hex digits (52 bits) to stay within MAX_SAFE_INTEGER (2^53 - 1)
 */
function hexToSeedString(hex: string): string {
  // Ensure 0x prefix
  const fullHex = hex.startsWith("0x") ? hex : `0x${hex}`;
  // Skip "0x" prefix, take next 13 hex chars (52 bits, safely within MAX_SAFE_INTEGER)
  const truncated = fullHex.slice(2, 15);
  return `parseInt("${truncated}", 16)`;
}

/**
 * Build the mutations array JavaScript code
 */
function buildMutationsArray(
  mutationSeeds: readonly `0x${string}`[],
  mutationTypes: readonly string[]
): string {
  if (mutationSeeds.length === 0) {
    return "[]";
  }
  
  const items = mutationSeeds.map((seed, i) => {
    const seedExpr = hexToSeedString(seed);
    return `[${seedExpr}, "${mutationTypes[i]}"]`;
  });
  
  return `[${items.join(", ")}]`;
}

/**
 * Build the custom palette array JavaScript code
 */
function buildPaletteArray(palette: readonly string[]): string {
  // Check if palette is empty (all empty strings)
  const hasCustomPalette = palette.some(color => color && color.length > 0);
  
  if (!hasCustomPalette) {
    return "[]";
  }
  
  const items = palette.map(color => `"${color}"`);
  return `[${items.join(", ")}]`;
}

/**
 * Build complete HTML document for a Spatters NFT
 * 
 * @param spattersScript - The complete spatters.js code
 * @param tokenData - Token data (seed, mutations, palette)
 * @returns Complete HTML document as string
 */
export function buildTokenHtml(
  spattersScript: string,
  tokenData: TokenData
): string {
  const seedExpr = hexToSeedString(tokenData.seed);
  const mutationsArray = buildMutationsArray(tokenData.mutationSeeds, tokenData.mutationTypes);
  const paletteArray = buildPaletteArray(tokenData.customPalette);
  const hasCustomPalette = tokenData.customPalette.some(c => c && c.length > 0);
  
  // Always pass all 3 arguments to match original spatters.html format
  // Even when no custom palette, pass empty array explicitly
  const generateCall = `generate(${seedExpr}, ${mutationsArray}, ${paletteArray});`;
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Spatters</title>
  <style>
    html { height: 100%; }
    body { 
      min-height: 100%; 
      margin: 0; 
      padding: 0; 
      background-color: #EBE5D9;
    }
    canvas { 
      padding: 0; 
      margin: auto; 
      display: block; 
      position: absolute; 
      top: 0; 
      bottom: 0; 
      left: 0; 
      right: 0; 
    }
  </style>
  <script src="${P5JS_CDN}"></script>
</head>
<body>
  <script>
${spattersScript}
  </script>
  <script>
    // Token data from on-chain
    const mintingSeed = ${seedExpr};
    const mutations = ${mutationsArray};
    ${hasCustomPalette ? `const customPalette = ${paletteArray};` : ""}
    
    // p5.js setup function - called automatically
    function setup() {
      ${generateCall}
    }
  </script>
</body>
</html>`;
}

/**
 * Build HTML for preview (before minting is complete)
 * Takes a single seed for preview
 */
export function buildPreviewHtml(
  spattersScript: string,
  previewSeed: `0x${string}`
): string {
  const seedExpr = hexToSeedString(previewSeed);
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Spatters Preview</title>
  <style>
    html { height: 100%; }
    body { 
      min-height: 100%; 
      margin: 0; 
      padding: 0; 
      background-color: #EBE5D9;
    }
    canvas { 
      padding: 0; 
      margin: auto; 
      display: block; 
      position: absolute; 
      top: 0; 
      bottom: 0; 
      left: 0; 
      right: 0; 
    }
  </style>
  <script src="${P5JS_CDN}"></script>
</head>
<body>
  <script>
${spattersScript}
  </script>
  <script>
    const mintingSeed = ${seedExpr};
    const mutations = [];
    const customPalette = [];
    function setup() {
      generate(mintingSeed, mutations, customPalette);
    }
  </script>
</body>
</html>`;
}

