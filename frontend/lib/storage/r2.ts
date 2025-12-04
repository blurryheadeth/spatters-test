/**
 * Cloudflare R2 Storage Provider
 * 
 * Stores pre-computed pixel data in Cloudflare R2 (S3-compatible).
 * Data is gzip-compressed before upload for efficiency.
 * 
 * R2 offers 10GB free tier, making it ideal for larger collections.
 * 
 * Setup:
 * 1. Create a Cloudflare account
 * 2. Create an R2 bucket named 'spatters-pixels'
 * 3. Create R2 API token with read/write permissions
 * 4. Set up a public domain for the bucket (optional, for CDN)
 * 5. Add credentials to .env.local
 */

import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { StorageProvider, TokenPixelData } from './types';
import pako from 'pako';

export class R2StorageProvider implements StorageProvider {
  private client: S3Client;
  private bucket: string;
  private publicUrl: string;

  constructor(
    accountId: string,
    accessKeyId: string,
    secretAccessKey: string,
    bucket: string = 'spatters-pixels',
    publicUrl?: string
  ) {
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
    this.bucket = bucket;
    // Public URL can be a custom domain or R2.dev URL
    this.publicUrl = publicUrl || `https://pub-${accountId}.r2.dev/${bucket}`;
  }

  private getFilePath(tokenId: number): string {
    return `${tokenId}.json.gz`;
  }

  async upload(tokenId: number, data: TokenPixelData): Promise<string> {
    const filePath = this.getFilePath(tokenId);
    
    // Serialize and compress
    const jsonString = JSON.stringify(data);
    const compressed = pako.gzip(jsonString);
    
    // Upload to R2
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: filePath,
      Body: compressed,
      ContentType: 'application/gzip',
      ContentEncoding: 'gzip',
    }));

    return this.getPublicUrl(tokenId);
  }

  async download(tokenId: number): Promise<TokenPixelData | null> {
    const filePath = this.getFilePath(tokenId);

    try {
      const response = await this.client.send(new GetObjectCommand({
        Bucket: this.bucket,
        Key: filePath,
      }));

      if (!response.Body) {
        return null;
      }

      // Read body as buffer
      const chunks: Uint8Array[] = [];
      const body = response.Body as AsyncIterable<Uint8Array>;
      for await (const chunk of body) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      
      // Decompress
      const decompressed = pako.ungzip(buffer, { to: 'string' });
      
      return JSON.parse(decompressed) as TokenPixelData;
    } catch (error: any) {
      if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  getPublicUrl(tokenId: number): string {
    return `${this.publicUrl}/${this.getFilePath(tokenId)}`;
  }

  async exists(tokenId: number): Promise<boolean> {
    const filePath = this.getFilePath(tokenId);
    
    try {
      await this.client.send(new HeadObjectCommand({
        Bucket: this.bucket,
        Key: filePath,
      }));
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  async delete(tokenId: number): Promise<void> {
    const filePath = this.getFilePath(tokenId);
    
    try {
      await this.client.send(new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: filePath,
      }));
    } catch (error: any) {
      // Ignore not found errors
      if (error.name !== 'NoSuchKey' && error.$metadata?.httpStatusCode !== 404) {
        throw error;
      }
    }
  }
}


