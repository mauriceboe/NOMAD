import crypto from 'crypto';
import { ENCRYPTION_KEY } from '../config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

export function encryptCredentials(plaintext: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = crypto.scryptSync(ENCRYPTION_KEY, salt, 32);
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();
  
  const combined = Buffer.concat([salt, iv, authTag, encrypted]);
  return combined.toString('base64');
}

export function decryptCredentials(ciphertext: string): string {
  const combined = Buffer.from(ciphertext, 'base64');
  
  const salt = combined.subarray(0, SALT_LENGTH);
  const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = combined.subarray(
    SALT_LENGTH + IV_LENGTH,
    SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
  );
  const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
  
  const key = crypto.scryptSync(ENCRYPTION_KEY, salt, 32);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]);
  
  return decrypted.toString('utf8');
}

export function createEncryptionStream(): {
  cipher: crypto.Cipheriv;
  iv: Buffer;
  salt: Buffer;
  getAuthTag: () => Buffer;
} {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = crypto.scryptSync(ENCRYPTION_KEY, salt, 32);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  return {
    cipher,
    iv,
    salt,
    getAuthTag: () => cipher.getAuthTag()
  };
}

export function createDecryptionStream(iv: Buffer, authTag: Buffer, salt: Buffer): crypto.Decipheriv {
  const key = crypto.scryptSync(ENCRYPTION_KEY, salt, 32);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher;
}
