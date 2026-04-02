import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { StorageBackend, DownloadResult, ListEntry, StoragePurpose } from './types';

export class LocalBackend implements StorageBackend {
  private baseDir: string;
  private legacyPrefix: string;

  constructor(purpose: StoragePurpose) {
    const rootDir = path.join(__dirname, '../../');
    
    switch (purpose) {
      case 'backup':
        this.baseDir = path.join(rootDir, 'data/backups');
        this.legacyPrefix = 'backup';
        break;
      case 'photos':
        this.baseDir = path.join(rootDir, 'uploads/photos');
        this.legacyPrefix = 'photos';
        break;
      case 'files':
        this.baseDir = path.join(rootDir, 'uploads/files');
        this.legacyPrefix = 'files';
        break;
      case 'covers':
        this.baseDir = path.join(rootDir, 'uploads/covers');
        this.legacyPrefix = 'covers';
        break;
      case 'avatars':
        this.baseDir = path.join(rootDir, 'uploads/avatars');
        this.legacyPrefix = 'avatars';
        break;
      default:
        throw new Error(`Unknown storage purpose: ${purpose}`);
    }

    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  /** Strip any legacy directory prefix and resolve to an absolute path within baseDir. */
  private resolveKey(key: string): string {
    // Strip a leading "<purpose>/" prefix that old code may have stored as part of the key
    const stripped = key.startsWith(this.legacyPrefix + '/')
      ? key.slice(this.legacyPrefix.length + 1)
      : key;

    const resolved = path.resolve(this.baseDir, stripped);

    // Guard against path traversal
    if (!resolved.startsWith(this.baseDir + path.sep) && resolved !== this.baseDir) {
      throw new Error('Invalid storage key: path traversal detected');
    }

    return resolved;
  }

  async store(key: string, data: Buffer | Readable): Promise<void> {
    const filePath = this.resolveKey(key);
    const dir = path.dirname(filePath);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (Buffer.isBuffer(data)) {
      fs.writeFileSync(filePath, data);
    } else {
      await new Promise<void>((resolve, reject) => {
        const writeStream = fs.createWriteStream(filePath);
        data.pipe(writeStream);
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });
    }
  }

  async download(key: string): Promise<DownloadResult> {
    const filePath = this.resolveKey(key);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${key}`);
    }

    const stream = fs.createReadStream(filePath);
    return { type: 'stream', stream };
  }

  async list(): Promise<ListEntry[]> {
    if (!fs.existsSync(this.baseDir)) {
      return [];
    }

    const files = fs.readdirSync(this.baseDir);
    const entries: ListEntry[] = [];

    for (const filename of files) {
      const filePath = path.join(this.baseDir, filename);
      try {
        const stat = fs.statSync(filePath);
        if (stat.isFile()) {
          entries.push({
            key: filename,
            size: stat.size,
            createdAt: stat.birthtime.toISOString(),
            source: 'local',
            targetName: 'Local'
          });
        }
      } catch (err) {
        continue;
      }
    }

    return entries.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async delete(key: string): Promise<void> {
    const filePath = this.resolveKey(key);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${key}`);
    }

    fs.unlinkSync(filePath);
  }

  async testConnection(): Promise<void> {
    if (!fs.existsSync(this.baseDir)) {
      throw new Error(`Directory not accessible: ${this.baseDir}`);
    }

    const testFile = path.join(this.baseDir, '.connection-test');
    try {
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
    } catch (err) {
      throw new Error(`Cannot write to directory: ${this.baseDir}`);
    }
  }
}
