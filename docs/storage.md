# External Storage Configuration

TREK supports storing backups, files, photos, covers, and avatars on external S3-compatible storage services. This allows you to:

- Scale storage independently from your TREK deployment
- Use cost-effective object storage (AWS S3, MinIO, Wasabi, Backblaze B2, etc.)
- Encrypt files at rest with AES-256-GCM
- Separate storage by purpose (backups, photos, files, etc.)

## Table of Contents

- [Overview](#overview)
- [Supported Storage Services](#supported-storage-services)
- [Configuration Methods](#configuration-methods)
- [Storage Purposes](#storage-purposes)
- [Environment Variable Bootstrap](#environment-variable-bootstrap)
- [Admin Panel Configuration](#admin-panel-configuration)
- [Encryption](#encryption)
- [Docker Compose Examples](#docker-compose-examples)
- [Kubernetes/Helm Examples](#kuberneteshelm-examples)
- [Migration Guide](#migration-guide)
- [Troubleshooting](#troubleshooting)

## Overview

TREK's storage system uses a flexible backend architecture:

- **Local Storage** (default): Files stored in `/app/uploads` directory
- **S3 Storage**: Files stored in S3-compatible object storage
- **Encrypted Storage**: Wraps any backend with AES-256-GCM encryption

Each storage purpose (backups, photos, files, covers, avatars) can be assigned to different storage targets, allowing fine-grained control over where data is stored.

## Supported Storage Services

Any S3-compatible storage service is supported:

- **AWS S3** - Amazon's object storage service
- **MinIO** - Self-hosted S3-compatible storage
- **Wasabi** - Cost-effective cloud storage
- **Backblaze B2** - Affordable cloud storage
- **DigitalOcean Spaces** - S3-compatible object storage
- **Cloudflare R2** - Zero-egress-fee object storage
- **Any S3-compatible service**

## Configuration Methods

There are two ways to configure external storage:

1. **Environment Variables** (first-boot only) - Automatically creates storage target on initial startup
2. **Admin Panel** (recommended) - Full control via web interface at Admin → Storage

**Important:** Environment variables only work on first boot. After initial setup, all storage configuration must be done through the admin panel to prevent conflicts with database state.

## Storage Purposes

TREK separates storage into five distinct purposes:

| Purpose | Description | Default Location |
|---------|-------------|------------------|
| **Backups** | Automatic and manual backup files | `/app/uploads/backups` |
| **Photos** | Trip photos and images | `/app/uploads/photos` |
| **Files** | Trip documents and attachments | `/app/uploads/files` |
| **Covers** | Trip cover images | `/app/uploads/covers` |
| **Avatars** | User profile pictures | `/app/uploads/avatars` |

Each purpose can be independently assigned to:
- Local storage (default)
- Any configured S3 storage target
- Any configured encrypted storage target

## Environment Variable Bootstrap

Configure S3 storage on first boot using environment variables:

### Required Variables

```bash
STORAGE_S3_BUCKET=my-trek-bucket
STORAGE_S3_REGION=us-east-1
STORAGE_S3_ACCESS_KEY_ID=your-access-key-id
STORAGE_S3_SECRET_ACCESS_KEY=your-secret-access-key
```

### Optional Variables

```bash
# Custom endpoint for non-AWS S3 services
STORAGE_S3_ENDPOINT=https://s3.wasabisys.com

# Path prefix within bucket (e.g., "trek/" or "prod/trek/")
STORAGE_S3_PATH_PREFIX=trek/

# Enable presigned URLs for direct downloads (faster, but requires public bucket access)
STORAGE_S3_USE_PRESIGNED_URLS=true

# Enable AES-256-GCM encryption at rest
STORAGE_S3_ENCRYPT_AT_REST=true
```

### Bootstrap Behavior

When environment variables are set:

1. **First Boot**: Creates a storage target named "S3 Storage" and assigns all purposes to it
2. **Subsequent Boots**: Environment variables are ignored; use admin panel for changes
3. **Idempotent**: Safe to leave environment variables set after first boot

## Admin Panel Configuration

After initial setup, manage storage through the admin panel:

### Creating Storage Targets

1. Navigate to **Admin → Storage**
2. Click **Add Storage Target**
3. Configure:
   - **Name**: Descriptive name (e.g., "Production S3", "Backup MinIO")
   - **Type**: S3
   - **Bucket**: S3 bucket name
   - **Region**: AWS region or equivalent
   - **Endpoint**: Custom endpoint for non-AWS services
   - **Access Key ID**: S3 access key
   - **Secret Access Key**: S3 secret key
   - **Path Prefix**: Optional path within bucket
   - **Use Presigned URLs**: Enable for direct downloads
   - **Encrypt at Rest**: Enable AES-256-GCM encryption
4. Click **Test** to verify connection
5. Click **Save**

### Assigning Storage Targets

1. Navigate to **Admin → Storage → Assignments**
2. For each purpose (Backups, Photos, Files, Covers, Avatars):
   - Select desired storage target from dropdown
   - Click **Assign Target**
3. Changes take effect immediately for new uploads

**Important:** Changing assignments only affects new uploads. Existing files remain in their current location.

### Managing Storage Targets

- **Edit**: Modify configuration (credentials can be updated without re-entering)
- **Test**: Verify connection at any time
- **Delete**: Remove target (fails if currently assigned to any purpose)

## Encryption

TREK supports AES-256-GCM encryption at rest for any storage backend:

### How It Works

- Files are encrypted before upload using AES-256-GCM
- Encryption key derived from `ENCRYPTION_KEY` environment variable
- Each file gets a unique initialization vector (IV)
- Encrypted files are stored with `.enc` extension
- Decryption happens automatically on download

### Enabling Encryption

**For Environment Variable Bootstrap:**
```bash
STORAGE_S3_ENCRYPT_AT_REST=true
```

**For Admin Panel:**
- Check "Encrypt files at rest (AES-256-GCM)" when creating/editing storage target

### Security Considerations

- Encryption key must be kept secure and backed up
- Losing `ENCRYPTION_KEY` makes encrypted files unrecoverable
- Encryption adds minimal performance overhead
- Presigned URLs are disabled when encryption is enabled (files must be proxied through TREK)

## Docker Compose Examples

### Example 1: AWS S3 with Encryption

```yaml
version: '3.8'
services:
  trek:
    image: mauriceboe/trek:latest
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      ENCRYPTION_KEY: your-32-byte-hex-key-here
      
      # S3 Storage Configuration
      STORAGE_S3_BUCKET: my-trek-bucket
      STORAGE_S3_REGION: us-east-1
      STORAGE_S3_ACCESS_KEY_ID: AKIAIOSFODNN7EXAMPLE
      STORAGE_S3_SECRET_ACCESS_KEY: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
      STORAGE_S3_PATH_PREFIX: trek/
      STORAGE_S3_ENCRYPT_AT_REST: "true"
    volumes:
      - trek-data:/app/data
    restart: unless-stopped

volumes:
  trek-data:
```

### Example 2: MinIO Self-Hosted

```yaml
version: '3.8'
services:
  trek:
    image: mauriceboe/trek:latest
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      ENCRYPTION_KEY: your-32-byte-hex-key-here
      
      # MinIO Configuration
      STORAGE_S3_ENDPOINT: http://minio:9000
      STORAGE_S3_BUCKET: trek
      STORAGE_S3_REGION: us-east-1
      STORAGE_S3_ACCESS_KEY_ID: minioadmin
      STORAGE_S3_SECRET_ACCESS_KEY: minioadmin
      STORAGE_S3_PATH_PREFIX: prod/
      STORAGE_S3_USE_PRESIGNED_URLS: "true"
    volumes:
      - trek-data:/app/data
    depends_on:
      - minio
    restart: unless-stopped

  minio:
    image: minio/minio:latest
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    command: server /data --console-address ":9001"
    volumes:
      - minio-data:/data
    restart: unless-stopped

volumes:
  trek-data:
  minio-data:
```

### Example 3: Wasabi Cloud Storage

```yaml
version: '3.8'
services:
  trek:
    image: mauriceboe/trek:latest
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      ENCRYPTION_KEY: your-32-byte-hex-key-here
      
      # Wasabi Configuration
      STORAGE_S3_ENDPOINT: https://s3.us-east-1.wasabisys.com
      STORAGE_S3_BUCKET: my-trek-bucket
      STORAGE_S3_REGION: us-east-1
      STORAGE_S3_ACCESS_KEY_ID: your-wasabi-access-key
      STORAGE_S3_SECRET_ACCESS_KEY: your-wasabi-secret-key
      STORAGE_S3_USE_PRESIGNED_URLS: "true"
    volumes:
      - trek-data:/app/data
    restart: unless-stopped

volumes:
  trek-data:
```

### Example 4: Backblaze B2

```yaml
version: '3.8'
services:
  trek:
    image: mauriceboe/trek:latest
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      ENCRYPTION_KEY: your-32-byte-hex-key-here
      
      # Backblaze B2 Configuration
      STORAGE_S3_ENDPOINT: https://s3.us-west-004.backblazeb2.com
      STORAGE_S3_BUCKET: my-trek-bucket
      STORAGE_S3_REGION: us-west-004
      STORAGE_S3_ACCESS_KEY_ID: your-b2-key-id
      STORAGE_S3_SECRET_ACCESS_KEY: your-b2-application-key
    volumes:
      - trek-data:/app/data
    restart: unless-stopped

volumes:
  trek-data:
```

## Kubernetes/Helm Examples

### Example 1: AWS S3 with Helm

```yaml
# values.yaml
env:
  STORAGE_S3_BUCKET: my-trek-bucket
  STORAGE_S3_REGION: us-east-1
  STORAGE_S3_PATH_PREFIX: trek/
  STORAGE_S3_USE_PRESIGNED_URLS: "true"
  STORAGE_S3_ENCRYPT_AT_REST: "true"

secretEnv:
  ENCRYPTION_KEY: "your-32-byte-hex-key-here"
  STORAGE_S3_ACCESS_KEY_ID: "AKIAIOSFODNN7EXAMPLE"
  STORAGE_S3_SECRET_ACCESS_KEY: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
```

```bash
helm install trek ./chart -f values.yaml
```

### Example 2: MinIO in Kubernetes

```yaml
# values.yaml
env:
  STORAGE_S3_ENDPOINT: "http://minio.default.svc.cluster.local:9000"
  STORAGE_S3_BUCKET: trek
  STORAGE_S3_REGION: us-east-1
  STORAGE_S3_USE_PRESIGNED_URLS: "true"

secretEnv:
  ENCRYPTION_KEY: "your-32-byte-hex-key-here"
  STORAGE_S3_ACCESS_KEY_ID: "minioadmin"
  STORAGE_S3_SECRET_ACCESS_KEY: "minioadmin"
```

## Migration Guide

### Migrating from Local to S3 Storage

1. **Configure S3 storage target** in Admin → Storage
2. **Test connection** to ensure it works
3. **Assign purposes** to new S3 target (Admin → Storage → Assignments)
4. **New uploads** will go to S3 automatically
5. **Migrate existing files** (optional):
   ```bash
   # Example: Copy photos to S3
   aws s3 sync /app/uploads/photos s3://my-bucket/trek/photos/
   ```
6. **Verify migration** by checking files are accessible
7. **Clean up local files** once verified (optional)

### Migrating Between S3 Providers

1. **Create new storage target** for destination provider
2. **Test connection**
3. **Copy data** between buckets:
   ```bash
   # Using AWS CLI
   aws s3 sync s3://old-bucket/trek/ s3://new-bucket/trek/
   ```
4. **Update assignments** to point to new target
5. **Verify** new uploads work correctly
6. **Delete old target** after verification

## Troubleshooting

### Connection Test Fails

**Symptoms:** "Connection failed" when testing storage target

**Solutions:**
- Verify credentials are correct
- Check bucket exists and is accessible
- Verify region matches bucket region
- For custom endpoints, ensure URL is correct and accessible
- Check network connectivity from TREK server to S3 endpoint
- Verify bucket permissions allow ListBucket and GetObject operations

### Files Not Uploading

**Symptoms:** Upload fails or files not appearing in S3

**Solutions:**
- Check storage assignment is configured correctly
- Verify bucket permissions allow PutObject operation
- Check disk space on TREK server (temporary storage during upload)
- Review TREK logs for detailed error messages
- Test storage target connection in admin panel

### Presigned URLs Not Working

**Symptoms:** Downloads fail when presigned URLs are enabled

**Solutions:**
- Ensure bucket has public read access (or appropriate bucket policy)
- Verify `STORAGE_S3_USE_PRESIGNED_URLS` is set to `"true"` (string, not boolean)
- Check bucket CORS configuration allows GET requests
- Presigned URLs don't work with encryption enabled (by design)

### Encryption Issues

**Symptoms:** Files can't be decrypted or appear corrupted

**Solutions:**
- Verify `ENCRYPTION_KEY` environment variable is set and hasn't changed
- Check that encrypted files have `.enc` extension
- Ensure encryption was enabled when files were uploaded
- Verify `ENCRYPTION_KEY` is the same across all TREK instances

### Performance Issues

**Symptoms:** Slow uploads or downloads

**Solutions:**
- Consider enabling presigned URLs for faster downloads (if encryption not needed)
- Check network bandwidth between TREK and S3 endpoint
- Use S3 endpoint closest to your TREK deployment
- For large files, consider increasing timeout values
- Monitor S3 request rates and throttling

### Environment Variables Ignored

**Symptoms:** Environment variables don't create storage target

**Solutions:**
- Environment variables only work on first boot
- Check if storage target already exists in database
- Delete existing storage targets if you want to re-bootstrap
- Use admin panel for configuration after first boot

## Best Practices

1. **Always set `ENCRYPTION_KEY`** and back it up securely
2. **Test storage targets** before assigning to purposes
3. **Use path prefixes** to organize files within buckets
4. **Enable encryption** for sensitive data
5. **Monitor storage costs** and set up billing alerts
6. **Regular backups** of TREK database (contains storage configuration)
7. **Use presigned URLs** for better performance when encryption isn't needed
8. **Separate buckets** for different environments (dev, staging, prod)
9. **Set up lifecycle policies** in S3 for automatic cleanup of old backups
10. **Document your storage configuration** for disaster recovery

## Support

For issues or questions:
- Check [GitHub Issues](https://github.com/mauriceboe/trek/issues)
- Review TREK logs for detailed error messages
- Consult S3 provider documentation for provider-specific issues