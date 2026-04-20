# Updating

How to update TREK to a newer version without losing data.

## Before You Update

Back up your data first. Go to Admin Panel → Backups and create a manual backup, or copy your `./data` and `./uploads` directories to a safe location. See [Backups] for details.

## Docker Compose (Recommended)

```bash
docker compose pull && docker compose up -d
```

This pulls the latest image and recreates the container with your existing volumes. Your data is untouched.

## Docker Run

If you started TREK with `docker run`, pull the new image and replace the container:

```bash
docker pull mauriceboe/trek
docker rm -f trek
docker run -d --name trek -p 3000:3000 \
  -v ./data:/app/data \
  -v ./uploads:/app/uploads \
  -e ENCRYPTION_KEY=<your-key> \
  --restart unless-stopped \
  mauriceboe/trek
```

> **Tip:** Not sure which volume paths you used? Check before removing:
> ```bash
> docker inspect trek --format '{{json .Mounts}}'
> ```

## Database Migrations

TREK runs any pending database migrations automatically at startup. No manual migration steps are required after pulling a new image.

## Encryption Key Note

If you are upgrading from a version that predates the dedicated `ENCRYPTION_KEY` (i.e. you have no `ENCRYPTION_KEY` environment variable set), TREK automatically falls back to `./data/.jwt_secret` on startup and immediately promotes it to `./data/.encryption_key`. No manual steps are required — the transition is handled at first boot after the upgrade.

If you want to rotate to a new key at any point (not required for a normal update), see [Encryption-Key-Rotation] for the full procedure.

## Unraid

In the Unraid Docker tab, click the TREK container and select **Update**. Unraid will pull the latest image and restart with the same volumes.

## Next Steps

- [Backups] — schedule automatic backups so you always have a restore point before updates
- [Encryption-Key-Rotation] — if you need to rotate or migrate the encryption key
- [Install-Docker-Compose] — switch to Compose for easier future updates
