/**
 * Storage Provider Factory
 * 
 * Creates the appropriate storage provider based on environment configuration.
 * 
 * To switch providers, change STORAGE_PROVIDER in .env.local:
 * - 'supabase' (default) - Uses Supabase Storage (1GB free)
 * - 'r2' - Uses Cloudflare R2 (10GB free)
 */

import { StorageProvider, StorageConfig } from './types';
import { SupabaseStorageProvider } from './supabase';
import { R2StorageProvider } from './r2';

export * from './types';

let storageInstance: StorageProvider | null = null;

/**
 * Get storage configuration from environment variables
 */
function getStorageConfig(): StorageConfig {
  const provider = (process.env.STORAGE_PROVIDER || 'supabase') as 'supabase' | 'r2';
  
  return {
    provider,
    
    // Supabase config
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    supabaseBucket: process.env.SUPABASE_BUCKET || 'spatters-pixels',
    
    // R2 config
    r2AccountId: process.env.R2_ACCOUNT_ID,
    r2AccessKeyId: process.env.R2_ACCESS_KEY_ID,
    r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    r2Bucket: process.env.R2_BUCKET || 'spatters-pixels',
    r2PublicUrl: process.env.R2_PUBLIC_URL,
  };
}

/**
 * Create storage provider based on configuration
 */
export function createStorageProvider(config?: StorageConfig): StorageProvider {
  const cfg = config || getStorageConfig();
  
  if (cfg.provider === 'r2') {
    if (!cfg.r2AccountId || !cfg.r2AccessKeyId || !cfg.r2SecretAccessKey) {
      throw new Error('R2 storage requires R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY');
    }
    return new R2StorageProvider(
      cfg.r2AccountId,
      cfg.r2AccessKeyId,
      cfg.r2SecretAccessKey,
      cfg.r2Bucket,
      cfg.r2PublicUrl
    );
  }
  
  // Default to Supabase
  if (!cfg.supabaseUrl || !cfg.supabaseServiceKey) {
    throw new Error('Supabase storage requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  }
  return new SupabaseStorageProvider(
    cfg.supabaseUrl,
    cfg.supabaseServiceKey,
    cfg.supabaseBucket
  );
}

/**
 * Get singleton storage provider instance
 */
export function getStorage(): StorageProvider {
  if (!storageInstance) {
    storageInstance = createStorageProvider();
  }
  return storageInstance;
}

/**
 * Get the public URL base for pixel data
 * Used by the lightweight viewer to fetch pre-computed pixels
 */
export function getPixelDataBaseUrl(): string {
  const config = getStorageConfig();
  
  if (config.provider === 'r2' && config.r2PublicUrl) {
    return config.r2PublicUrl;
  }
  
  if (config.supabaseUrl) {
    return `${config.supabaseUrl}/storage/v1/object/public/${config.supabaseBucket || 'spatters-pixels'}`;
  }
  
  // Fallback to API route (proxies to storage)
  return '/api/pixels';
}


