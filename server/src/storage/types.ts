import { Readable } from 'stream';

export enum StoragePurpose {
  BACKUP = 'backup',
  PHOTOS = 'photos',
  FILES = 'files',
  COVERS = 'covers',
  AVATARS = 'avatars'
}

export type DownloadResult =
  | { type: 'stream'; stream: NodeJS.ReadableStream }
  | { type: 'redirect'; url: string };

export type ListEntry = {
  key: string;
  size: number;
  createdAt: string;
  source: 'local' | `target:${number}`;
  targetName: string;
};

export interface StorageBackend {
  store(key: string, data: Buffer | Readable): Promise<void>;
  download(key: string): Promise<DownloadResult>;
  list(): Promise<ListEntry[]>;
  delete(key: string): Promise<void>;
  testConnection(): Promise<void>;
}

export type StorageTargetType = 's3';

export interface S3Config {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  pathPrefix?: string;
  use_presigned_urls?: boolean;
}

export type StorageTargetConfig = S3Config;

export interface StorageTarget {
  id: number;
  name: string;
  type: StorageTargetType;
  config_encrypted: string;
  encrypt: number;
  enabled: number;
  created_at: string;
  updated_at: string;
}

export interface StorageAssignment {
  purpose: StoragePurpose;
  target_id: number | null;
}
