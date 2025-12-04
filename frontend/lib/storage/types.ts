/**
 * Storage Provider Abstraction
 * 
 * This module provides an abstract interface for storing and retrieving
 * pre-computed pixel data. The implementation can be swapped between
 * Supabase Storage and Cloudflare R2 (or any S3-compatible storage)
 * by changing environment variables.
 * 
 * To switch providers:
 * 1. Set STORAGE_PROVIDER env var to 'supabase' or 'r2'
 * 2. Configure the appropriate credentials in env
 */

export interface TokenPixelData {
  tokenId: number;
  width: number;
  height: number;
  canvasHistory: number[][];  // Array of pixel arrays (RGBA values)
  generatedAt: string;        // ISO timestamp
  mutationCount: number;      // Number of mutations applied
}

export interface StorageProvider {
  /**
   * Upload pixel data for a token
   * @param tokenId - The NFT token ID
   * @param data - The pixel data to store
   * @returns Public URL to access the data
   */
  upload(tokenId: number, data: TokenPixelData): Promise<string>;

  /**
   * Download pixel data for a token
   * @param tokenId - The NFT token ID
   * @returns The pixel data, or null if not found
   */
  download(tokenId: number): Promise<TokenPixelData | null>;

  /**
   * Get public URL for a token's pixel data
   * @param tokenId - The NFT token ID
   * @returns Public URL (may not exist yet)
   */
  getPublicUrl(tokenId: number): string;

  /**
   * Check if pixel data exists for a token
   * @param tokenId - The NFT token ID
   */
  exists(tokenId: number): Promise<boolean>;

  /**
   * Delete pixel data for a token (for regeneration)
   * @param tokenId - The NFT token ID
   */
  delete(tokenId: number): Promise<void>;
}

export interface StorageConfig {
  provider: 'supabase' | 'r2';
  
  // Supabase config
  supabaseUrl?: string;
  supabaseServiceKey?: string;
  supabaseBucket?: string;
  
  // Cloudflare R2 config (S3-compatible)
  r2AccountId?: string;
  r2AccessKeyId?: string;
  r2SecretAccessKey?: string;
  r2Bucket?: string;
  r2PublicUrl?: string;
}


