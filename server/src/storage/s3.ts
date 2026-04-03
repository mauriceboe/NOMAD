import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import { StorageBackend, DownloadResult, ListEntry, S3Config } from './types';

export class S3Backend implements StorageBackend {
  private client: S3Client;
  private config: S3Config;
  private targetId: number;
  private targetName: string;

  constructor(config: S3Config, targetId: number = 0, targetName: string = 'S3') {
    this.config = config;
    this.targetId = targetId;
    this.targetName = targetName;
    this.client = new S3Client({
      endpoint: config.endpoint || undefined,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      },
      forcePathStyle: true
    });
  }

  private getKey(key: string): string {
    return this.config.pathPrefix ? `${this.config.pathPrefix}/${key}` : key;
  }

  async store(key: string, data: Buffer | Readable): Promise<void> {
    const s3Key = this.getKey(key);
    
    let body: Buffer | Readable;
    if (Buffer.isBuffer(data)) {
      body = data;
    } else {
      body = data;
    }

    await this.client.send(new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: s3Key,
      Body: body
    }));
  }

  async download(key: string): Promise<DownloadResult> {
    const s3Key = this.getKey(key);

    if (this.config.use_presigned_urls) {
      const command = new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: s3Key
      });
      const url = await getSignedUrl(this.client, command, { expiresIn: 3600 });
      return { type: 'redirect', url };
    }

    const response = await this.client.send(new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: s3Key
    }));

    if (!response.Body) {
      throw new Error(`No body in S3 response for key: ${key}`);
    }

    return { type: 'stream', stream: response.Body as Readable };
  }

  async list(): Promise<ListEntry[]> {
    const prefix = this.config.pathPrefix || '';
    const allObjects: { Key: string; Size: number; LastModified: Date }[] = [];
    let continuationToken: string | undefined;

    do {
      const response = await this.client.send(new ListObjectsV2Command({
        Bucket: this.config.bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken
      }));

      for (const obj of response.Contents ?? []) {
        if (obj.Key && obj.Size !== undefined && obj.LastModified) {
          allObjects.push({ Key: obj.Key, Size: obj.Size, LastModified: obj.LastModified });
        }
      }

      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);

    const entries: ListEntry[] = allObjects.map(obj => {
      let key = obj.Key;
      if (prefix && key.startsWith(prefix + '/')) {
        key = key.substring(prefix.length + 1);
      }
      return {
        key,
        size: obj.Size,
        createdAt: obj.LastModified.toISOString(),
        source: `target:${this.targetId}`,
        targetName: this.targetName
      };
    });

    return entries.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async delete(key: string): Promise<void> {
    const s3Key = this.getKey(key);
    
    await this.client.send(new DeleteObjectCommand({
      Bucket: this.config.bucket,
      Key: s3Key
    }));
  }

  async testConnection(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({
        Bucket: this.config.bucket
      }));
    } catch (err: any) {
      if (err.name === 'NotFound') {
        throw new Error(`Bucket not found: ${this.config.bucket}`);
      }
      if (err.name === 'Forbidden') {
        throw new Error('Access denied - check credentials');
      }
      throw new Error(`Connection failed: ${err.message || 'Unknown error'}`);
    }
  }
}
