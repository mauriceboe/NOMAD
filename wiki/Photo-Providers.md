# Photo Providers

TREK can browse your personal photo library on Immich or Synology Photos and attach selected photos to trips. TREK never copies the original files — it stores only a reference (provider name + asset ID) and proxies all image streams through its own server, so your provider credentials are never sent to the browser.

> **Admin:** Two things must be enabled for photo providers to appear in Settings: the **Memories addon** and the **individual photo provider** (Immich or Synology Photos). Both are toggled separately in **Admin → Addons**. See [Admin-Addons](Admin-Addons). If your provider is on a local or private network, the server must be configured to allow internal network access. See [Internal-Network-Access](Internal-Network-Access).

---

## Supported providers

| Provider | Internal ID |
|----------|-------------|
| Immich | `immich` |
| Synology Photos | `synologyphotos` |

Both providers can be active at the same time.

---

## Configuring a provider

Go to **Settings → Integrations → Photo Providers**. Each enabled provider shows its own settings section.

<!-- TODO: screenshot: Photo Providers section in Settings > Integrations -->

### Immich

| Field | Required | Notes |
|-------|----------|-------|
| Server URL | Yes | Full URL of your Immich instance, e.g. `https://immich.example.com` |
| API Key | Yes | Stored encrypted; never returned to the browser after saving |
| Auto-upload to Immich | No | Checkbox; when enabled, photos you upload in TREK are also pushed to your Immich library |

Enter the full URL of your Immich instance and an Immich API key. The API key is stored encrypted on the TREK server and is never returned to the browser after it is saved.

### Synology Photos

| Field | Required | Notes |
|-------|----------|-------|
| Server URL | Yes | Full URL including the Photos app path, e.g. `https://your-nas:5001/photo` |
| Username | Yes | Synology account username |
| Password | Yes | Stored encrypted; leave blank to keep the existing password |
| OTP code | No | One-time password for 2FA; only needed on first connection or when re-authenticating |
| Skip SSL verification | No | Checkbox; disable TLS certificate validation for self-signed certificates |

---

## Testing the connection

Each provider section has a **Test Connection** button. Clicking it sends your current field values to the server and attempts to authenticate with the provider. A green "Connected" badge confirms success; any error message from the provider is shown if it fails.

For Synology, a successful test stores a session token so the OTP code is not required again on subsequent saves (as long as the URL and username remain the same).

---

## Multiple providers

You can configure both Immich and Synology simultaneously. TREK queries photos from all enabled providers when loading trip photos.

---

## After setup

Once a provider is connected, you can browse and attach photos to your trips. See [Documents-and-Files](Documents-and-Files) for how to manage files after setup.

---

## See also

- [Admin-Addons](Admin-Addons)
- [Internal-Network-Access](Internal-Network-Access)
