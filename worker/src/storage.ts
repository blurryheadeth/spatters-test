/**
 * Storage utilities for the worker
 * Mirrors the frontend storage abstraction
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import pako from 'pako';

export interface TokenPixelData {
  tokenId: number;
  width: number;
  height: number;
  canvasHistory: number[][];
  generatedAt: string;
  mutationCount: number;
}

export interface StorageProvider {
  upload(tokenId: number, data: TokenPixelData): Promise<string>;
  uploadSvg(tokenId: number, svgString: string): Promise<string>;
  download(tokenId: number): Promise<TokenPixelData | null>;
}

export class SupabaseStorageProvider implements StorageProvider {
  private client: SupabaseClient;
  private bucket: string;
  private publicUrl: string;

  constructor(supabaseUrl: string, supabaseServiceKey: string, bucket: string = 'spatters-pixels') {
    this.client = createClient(supabaseUrl, supabaseServiceKey);
    this.bucket = bucket;
    this.publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}`;
  }

  async upload(tokenId: number, data: TokenPixelData): Promise<string> {
    const filePath = `${tokenId}.json.gz`;
    const jsonString = JSON.stringify(data);
    const compressed = pako.gzip(jsonString);

    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(filePath, compressed, {
        contentType: 'application/gzip',
        upsert: true,
      });

    if (error) {
      throw new Error(`Failed to upload: ${error.message}`);
    }

    return `${this.publicUrl}/${filePath}`;
  }

  async uploadSvg(tokenId: number, svgString: string): Promise<string> {
    const filePath = `${tokenId}.svg`;

    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(filePath, svgString, {
        contentType: 'image/svg+xml',
        upsert: true,
      });

    if (error) {
      throw new Error(`Failed to upload SVG: ${error.message}`);
    }

    return `${this.publicUrl}/${filePath}`;
  }

  async download(tokenId: number): Promise<TokenPixelData | null> {
    const filePath = `${tokenId}.json.gz`;

    const { data, error } = await this.client.storage
      .from(this.bucket)
      .download(filePath);

    if (error || !data) {
      return null;
    }

    const arrayBuffer = await data.arrayBuffer();
    const decompressed = pako.ungzip(new Uint8Array(arrayBuffer), { to: 'string' });
    return JSON.parse(decompressed) as TokenPixelData;
  }
}

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
      credentials: { accessKeyId, secretAccessKey },
    });
    this.bucket = bucket;
    this.publicUrl = publicUrl || `https://pub-${accountId}.r2.dev/${bucket}`;
  }

  async upload(tokenId: number, data: TokenPixelData): Promise<string> {
    const filePath = `${tokenId}.json.gz`;
    const jsonString = JSON.stringify(data);
    const compressed = pako.gzip(jsonString);

    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: filePath,
      Body: compressed,
      ContentType: 'application/gzip',
    }));

    return `${this.publicUrl}/${filePath}`;
  }

  async uploadSvg(tokenId: number, svgString: string): Promise<string> {
    const filePath = `${tokenId}.svg`;

    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: filePath,
      Body: svgString,
      ContentType: 'image/svg+xml',
    }));

    return `${this.publicUrl}/${filePath}`;
  }

  async download(tokenId: number): Promise<TokenPixelData | null> {
    const filePath = `${tokenId}.json.gz`;

    try {
      const response = await this.client.send(new GetObjectCommand({
        Bucket: this.bucket,
        Key: filePath,
      }));

      if (!response.Body) {
        return null;
      }

      const chunks: Uint8Array[] = [];
      const body = response.Body as AsyncIterable<Uint8Array>;
      for await (const chunk of body) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      const decompressed = pako.ungzip(buffer, { to: 'string' });
      return JSON.parse(decompressed) as TokenPixelData;
    } catch (error: any) {
      if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
        return null;
      }
      throw error;
    }
  }
}

export function createStorage(): StorageProvider {
  const provider = process.env.STORAGE_PROVIDER || 'supabase';

  if (provider === 'r2') {
    const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL } = process.env;
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
      throw new Error('R2 credentials required');
    }
    return new R2StorageProvider(R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL);
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_BUCKET } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase credentials required');
  }
  return new SupabaseStorageProvider(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_BUCKET);
}


