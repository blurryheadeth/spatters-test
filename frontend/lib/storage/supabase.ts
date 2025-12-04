/**
 * Supabase Storage Provider
 * 
 * Stores pre-computed pixel data in Supabase Storage.
 * Data is gzip-compressed before upload for efficiency.
 * 
 * Setup:
 * 1. Create a Supabase project at https://supabase.com
 * 2. Create a storage bucket named 'spatters-pixels'
 * 3. Set the bucket to public for CDN delivery
 * 4. Add credentials to .env.local
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { StorageProvider, TokenPixelData } from './types';
import pako from 'pako';

export class SupabaseStorageProvider implements StorageProvider {
  private client: SupabaseClient;
  private bucket: string;
  private publicUrl: string;

  constructor(
    supabaseUrl: string,
    supabaseServiceKey: string,
    bucket: string = 'spatters-pixels'
  ) {
    this.client = createClient(supabaseUrl, supabaseServiceKey);
    this.bucket = bucket;
    this.publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}`;
  }

  private getFilePath(tokenId: number): string {
    return `${tokenId}.json.gz`;
  }

  async upload(tokenId: number, data: TokenPixelData): Promise<string> {
    const filePath = this.getFilePath(tokenId);
    
    // Serialize and compress
    const jsonString = JSON.stringify(data);
    const compressed = pako.gzip(jsonString);
    
    // Upload to Supabase Storage
    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(filePath, compressed, {
        contentType: 'application/gzip',
        upsert: true, // Overwrite if exists (for mutations)
      });

    if (error) {
      throw new Error(`Failed to upload pixel data: ${error.message}`);
    }

    return this.getPublicUrl(tokenId);
  }

  async download(tokenId: number): Promise<TokenPixelData | null> {
    const filePath = this.getFilePath(tokenId);

    const { data, error } = await this.client.storage
      .from(this.bucket)
      .download(filePath);

    if (error) {
      // Handle various "not found" error formats
      const errorStr = JSON.stringify(error);
      if (
        error.message?.includes('not found') ||
        error.message?.includes('Not Found') ||
        error.message?.includes('Object not found') ||
        (error as any).statusCode === '404' ||
        (error as any).status === 404
      ) {
        return null;
      }
      // If it's a download error for a non-existent file, return null
      if (!data) {
        return null;
      }
      throw new Error(`Failed to download pixel data: ${errorStr}`);
    }

    if (!data) {
      return null;
    }

    // Decompress
    const arrayBuffer = await data.arrayBuffer();
    const decompressed = pako.ungzip(new Uint8Array(arrayBuffer), { to: 'string' });
    
    return JSON.parse(decompressed) as TokenPixelData;
  }

  getPublicUrl(tokenId: number): string {
    return `${this.publicUrl}/${this.getFilePath(tokenId)}`;
  }

  async exists(tokenId: number): Promise<boolean> {
    const filePath = this.getFilePath(tokenId);
    
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .list('', { search: filePath });

    if (error) {
      return false;
    }

    return data.some(file => file.name === filePath);
  }

  async delete(tokenId: number): Promise<void> {
    const filePath = this.getFilePath(tokenId);
    
    const { error } = await this.client.storage
      .from(this.bucket)
      .remove([filePath]);

    if (error && !error.message.includes('not found')) {
      throw new Error(`Failed to delete pixel data: ${error.message}`);
    }
  }
}


