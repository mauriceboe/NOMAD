# TREK External Storage Targets — Implementation Plan

## Context

Implementing GitHub Discussion #228 (External Backup Targets) for the TREK codebase (`wheetazlab/TREK`, branch `feature-external-storage`).

**Tech stack:**
- Frontend: React 18 + TypeScript + Vite + Tailwind CSS + Zustand + lucide-react
- Backend: Node.js 22 + Express + TypeScript + better-sqlite3 (SQLite)
- Backup: `archiver` (zip) + `unzipper` (restore) + `multer` (upload) + `node-cron` scheduler

**Design decisions:**
- Multiple named S3 storage targets, each with independent assignment per purpose
- Purposes: `backup`, `photos`, `files`, `covers`, `avatars`
- Local is always available as a built-in target (`target_id = NULL`), zero config required
- AES-256-GCM encryption at rest for **all content** stored on external targets (backups, photos, files, covers, avatars); `EncryptedBackend` is applied whenever the target has `encrypt = 1`, regardless of purpose; credential encryption also uses `crypto.scryptSync(JWT_SECRET, salt, 32)`
- Fail hard (return error) if a configured external target is unreachable — do not silently fall back to local
- Server returns 409 if deletion is attempted on a target referenced by any assignment
- S3 `use_presigned_urls` flag stored in encrypted config JSON (default `false`); when `true`, `download()` returns a presigned redirect — safe default for self-hosted MinIO where internal endpoint is unreachable from browsers
- `source` param shape for backup download/restore/delete: `source=local` or `source=target:{id}` — avoids magic integers for the local case
- Generic backend covers user uploads (photos, files, covers, avatars)
- Restore: merge local + external backup listings in the UI
- "Use same target for all uploads" convenience toggle in Settings tab sets photos/files/covers/avatars all at once (backup excluded); individual per-purpose dropdowns remain visible for overrides

---

## Phase 1 — Storage Interface & Local Backend

Create:
- `server/src/storage/types.ts` — `StorageBackend` interface: `store`, `list`, `delete`, `testConnection`; `StorageTargetConfig` type; `StoragePurpose` enum; plus explicit return types:
  ```ts
  type DownloadResult =
    | { type: 'stream'; stream: NodeJS.ReadableStream }
    | { type: 'redirect'; url: string }
  download(key: string): Promise<DownloadResult>

  type ListEntry = {
    key: string           // storage key / filename
    size: number          // bytes
    createdAt: string     // ISO 8601
    source: 'local' | `target:${number}`  // for source badges in BackupPanel
    targetName: string    // resolved display name — 'Local' for local, target.name for external; resolved server-side so BackupPanel needs no extra fetch
  }
  list(): Promise<ListEntry[]>
  ```
  `fileProxy.ts` and backup download handlers must check `result.type`: pipe the stream if `'stream'`, issue a 302 with `Location` header if `'redirect'`. `EncryptedBackend` always returns `'stream'` (it must decrypt inline). `S3Backend` returns `'redirect'` only when `use_presigned_urls=true` AND the factory did not wrap it in `EncryptedBackend`. The backup route list handler populates `source` and `targetName` server-side by joining against `storage_targets` — `BackupPanel` uses `targetName` directly for badge rendering and requires no separate targets fetch.
- `server/src/storage/crypto.ts` — AES-256-GCM encrypt/decrypt for credentials at rest using `JWT_SECRET`
- `server/src/storage/local.ts` — `LocalBackend implements StorageBackend` (wraps existing fs operations; `download()` always returns `{ type: 'stream' }`; `list()` sets `source: 'local'`, `targetName: 'Local'` on every entry)

## Phase 2 — S3 Backend

Install: `@aws-sdk/client-s3`

No Dockerfile changes required — `@aws-sdk/client-s3` is a pure-JS package, no native build dependencies needed.

Create:
- `server/src/storage/s3.ts` — `S3Backend implements StorageBackend` using `@aws-sdk/client-s3`; config: `endpoint`, `bucket`, `region`, `accessKeyId`, `secretAccessKey`, `pathPrefix`, `use_presigned_urls` (boolean, default `false`); `download()` returns a presigned S3 redirect (302) when `use_presigned_urls=true`, otherwise streams proxy

## Phase 3 — Encrypted Decorator

Create:
- `server/src/storage/encrypted.ts` — `EncryptedBackend` decorator that wraps any `StorageBackend`; AES-256-GCM stream/buffer encryption applied transparently on `store`/`download` for **all purposes** — backups, photos, files, covers, avatars; files are stored as ciphertext and decrypted on the way out via the file proxy or backup download handler

## Phase 4 — DB Migration & Factory

Modify:
- `server/src/db/migrations.ts` — add migration for two new tables:

```sql
CREATE TABLE IF NOT EXISTS storage_targets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('s3')),
  config_encrypted TEXT NOT NULL,
  encrypt INTEGER NOT NULL DEFAULT 0,  -- applies to all purposes, not just backup
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Trigger to keep updated_at current on every UPDATE
CREATE TRIGGER IF NOT EXISTS storage_targets_updated_at
  AFTER UPDATE ON storage_targets
  FOR EACH ROW BEGIN
    UPDATE storage_targets SET updated_at = datetime('now') WHERE id = OLD.id;
  END;

CREATE TABLE IF NOT EXISTS storage_assignments (
  purpose TEXT PRIMARY KEY CHECK(purpose IN ('backup','photos','files','covers','avatars')),
  target_id INTEGER REFERENCES storage_targets(id) ON DELETE RESTRICT
  -- NULL means local
);
```

Create:
- `server/src/storage/factory.ts` — `getBackend(purpose: StoragePurpose): StorageBackend`; reads assignment from DB, decrypts credentials, instantiates correct backend class, wraps in `EncryptedBackend` if `encrypt = 1` — applied for **all purposes**, not conditionally on backup
  - **Backend instance cache**: maintain a `Map<number, StorageBackend>` keyed on `target_id`; on each `getBackend()` call, return the cached instance if present rather than re-reading DB and re-decrypting credentials.
  - **Cache invalidation**: export an `invalidateBackendCache(targetId?: number)` function; call it with the specific `targetId` from the PUT `/api/storage/targets/:id` handler; call it with no argument (clear all) from the DELETE handler and from the PUT `/api/storage/assignments/:purpose` handler (assignment change may point a purpose at a different target). Cross-referenced in Phase 5.

## Phase 5 — API Routes

Create:
- `server/src/routes/storageTargets.ts`
  - `GET /api/storage/targets` — list all (credentials redacted)
  - `POST /api/storage/targets` — create target (encrypt credentials before insert)
  - `PUT /api/storage/targets/:id` — update target; call `invalidateBackendCache(id)` after successful update
  - `DELETE /api/storage/targets/:id` — delete; explicitly catch `err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY'` in the handler and return 409 — do not rely on the DB-level `ON DELETE RESTRICT` alone to produce a clean HTTP response; call `invalidateBackendCache(id)` after successful delete
  - `POST /api/storage/targets/:id/test` — call `testConnection()` on the backend; return `{ success: boolean, message: string }` — the `message` field carries actionable error detail (e.g. "Connection refused", "Bucket not found", "Auth failed") or "OK" on success; do not return a bare boolean

- `server/src/routes/storageAssignments.ts`
  - `GET /api/storage/assignments` — list all 5 purpose rows (with `null` where unset = local)
  - `PUT /api/storage/assignments/:purpose` — set or clear (null) assignment for a purpose; call `invalidateBackendCache()` (no argument — clears all) after successful update, since the purpose now points at a different backend

Register both routers in `server/src/index.ts` (or wherever routes are wired).

**Pre-modification diff** — before touching any Modify-listed files in Phase 5 and beyond, run:
```bash
git diff main...dev -- server/src/index.ts client/src/pages/AdminPage.tsx client/src/api/client.ts
```
Document any existing route registrations or tab array entries already present in `dev` and adjust the Modify steps to avoid duplicate route mounts or duplicate tab entries.

## Phase 6 — Bootstrap Storage on Startup

**Startup execution order**: both functions are called **inside the `app.listen()` callback** in `server/src/index.ts` — the existing startup sequence (DB init, `scheduler.start()`, route registration) all lives inside that callback, not at module top-level. No new folder is created — the logic lives in `server/src/storage/factory.ts` (seeding) or as standalone functions imported into `index.ts`.

**Migrations do not need an explicit call here**: `runMigrations` is invoked automatically when `db/database.ts` is first imported (consistent with all existing migrations). The new `storage_targets` and `storage_assignments` tables will already exist before the bootstrap functions run — no explicit migration call is needed in `index.ts` or in the bootstrap code.

Add to `server/src/index.ts`:
1. **`envBootstrapStorage()`** — runs first; reads environment variables and, on first boot only, creates storage targets and assignments in the DB. Behavior:
  - **Idempotent**: checks for an existing row with the same `name` in `storage_targets` before inserting; skips (does not overwrite) if already present. Credentials written to DB are encrypted via `crypto.ts` immediately. Not re-read from env on subsequent restarts — UI is authoritative after first write. Matches OIDC env var behavior already in TREK.
  - **Validation**: if a `STORAGE_ASSIGN_*` value references `s3` but the corresponding target env vars are absent/incomplete, log a warning and fall back to `local` — do not throw or crash.
  - **Supported env vars** (all optional; absence = no env bootstrap for that target):
    ```
    # S3 target
    STORAGE_S3_NAME=          # display name (default: "S3")
    STORAGE_S3_ENDPOINT=      # required to trigger S3 bootstrap
    STORAGE_S3_BUCKET=
    STORAGE_S3_REGION=
    STORAGE_S3_ACCESS_KEY=
    STORAGE_S3_SECRET_KEY=
    STORAGE_S3_PATH_PREFIX=   # optional
    STORAGE_S3_ENCRYPT=false  # optional, default false
    STORAGE_S3_PRESIGNED_URLS=false  # optional, default false

    # Assignments (which purpose uses which bootstrapped target)
    STORAGE_ASSIGN_BACKUP=local   # s3 | local (default: local)
    STORAGE_ASSIGN_PHOTOS=local
    STORAGE_ASSIGN_FILES=local
    STORAGE_ASSIGN_COVERS=local
    STORAGE_ASSIGN_AVATARS=local
    ```

2. **`bootstrapStorageAssignments()`** — runs second; seeds the 5 `storage_assignments` rows with `target_id = NULL` if they don't already exist (ensures local is the default for any purpose not already set by `envBootstrapStorage`).

Both functions can live in `server/src/storage/factory.ts` or as a small `server/src/storage/bootstrap.ts` helper — either is fine, but no new `startup/` directory.

**Docker Compose / docs example** — `docs/README.md` does not exist (the `docs/` folder contains only screenshots and a PDF). Add the env bootstrap section to the **root `README.md`** or create **`docs/storage.md`** as a dedicated page. Preferred: `docs/storage.md` to keep the root README concise. Content should cover: S3 to MinIO, assignment overrides, and the first-boot-only note.

## Phase 7 — Rewire Backup Route & Scheduler

Modify:
- `server/src/routes/backup.ts`
  - All create/list/download/restore/delete handlers call `getBackend('backup')` instead of direct fs
  - **Backup list handler**: after calling `backend.list()`, join against `storage_targets` in SQLite to resolve `targetName` for each entry; for local entries set `targetName = 'Local'`; this is the server-side resolution so `BackupPanel` can render the source badge directly from the list response without a separate targets fetch
  - Add `source` query param to download/restore/delete to disambiguate local vs external; shape: `source=local` or `source=target:{id}` (string, not integer)
  - Keep `backupRateLimiter(3, 1hr)` in place (confirmed: it covers POST `/backup/create` only — no change needed)
  - **Filename validation regex**: the download handler validates filenames against `/^backup-[\w\-]+\.zip$/`. Scheduler auto-backups (`auto-backup-{timestamp}.zip`) and manual backups (`backup-{timestamp}.zip`) both pass this regex. However, if an external target's `pathPrefix` or storage key changes the effective filename format, valid external keys may be rejected — **review and update this regex** when implementing the external download handler so that pathPrefix-qualified or otherwise-formatted keys are accepted.
  - **`restoreFromZip()` refactor required**: currently takes a `zipPath: string` and opens its own `fs.createReadStream` internally. Since the external backend returns a `DownloadResult` stream (not a file path), `restoreFromZip` must be changed to accept a `NodeJS.ReadableStream` instead of a path. Both existing callers (restore-by-filename and upload-restore) must be updated to open the stream before calling. This is a small but required interface change.
  - **Temp file cleanup (upload-restore)**: the current code runs `fs.unlinkSync(zipPath)` after `await restoreFromZip(...)`, outside a `finally`. Post-refactor the upload-restore handler opens a stream from the temp file then passes it to `restoreFromZip`. Wrap the entire call (stream open + `restoreFromZip` + any post-restore logic) in a `try/finally` so the temp file is always deleted — even if `restoreFromZip` throws or the response write fails midway.
  - **Audit log**: `backup.ts` currently calls `writeAudit()` for restore (both local-file and upload paths) and delete events. These `writeAudit` calls must be preserved in the rewired handlers. Additionally, add a `writeAudit` call for manual backup creation that records which storage target was used (`resource` field: target name or `'local'`).

- `server/src/scheduler.ts`
  - `runBackup()` uses `getBackend('backup')` from factory instead of direct archiver-to-local-fs
  - `cleanupOldBackups(keepDays)` calls `backend.list()` + `backend.delete()` instead of direct fs unlink; **age-based deletion logic must be preserved** — the existing implementation deletes files older than `keepDays` days by `birthtimeMs`; the rewired version must filter `ListEntry.createdAt` against the cutoff (`Date.now() - keepDays * 86400000`). Do not switch to a count-based approach.
  - Scheduler currently uses `logInfo`/`logError` from `auditLog` service (not `writeAudit`) — preserve those calls; add a `logInfo` for auto-backup noting the storage target used

## Phase 8 — Rewire Upload Routes & File Proxy

Modify:
- Upload routes for photos, files, covers, avatars — after multer writes to temp, stream to `getBackend(purpose).store()` then delete local temp; use `try/finally` to guarantee temp file cleanup even if `store()` throws or rejects midway
- Serving/download routes — call `getBackend(purpose).download()`, check `DownloadResult.type`: pipe stream or issue 302 redirect

Create:
- `server/src/routes/fileProxy.ts` — generic proxy handler: `GET /api/files/:purpose/:key` → calls `getBackend(purpose).download(key)`, checks `DownloadResult.type`: if `'stream'` pipe to response; if `'redirect'` send `302` with `Location` header

## Phase 9 — Frontend UI

Create:
- `client/src/components/Admin/StorageTargetsPanel.tsx`
  - New admin tab panel: "Storage"
  - Card section: list of configured targets — name, S3 type badge, test connection button, edit/delete buttons
  - Add Target modal — S3 form fields: `endpoint`, `bucket`, `region`, `accessKeyId`, `secretAccessKey`, `pathPrefix`, `use_presigned_urls` checkbox (helper text: "Only enable if your S3 endpoint is publicly reachable from browsers"); when `encrypt` is also checked, show an inline note: "Presigned URL serving is bypassed when encryption is enabled — files are decrypted and streamed through the server" — both checkboxes remain independently settable
  - `encrypt` checkbox: "Encrypt all files at rest (AES-256-GCM)" (default off)
  - Runtime precedence (enforced in factory, not UI): if `encrypt = true`, `download()` always proxies through `EncryptedBackend` for decryption regardless of `use_presigned_urls` — presigned redirect is silently skipped; `use_presigned_urls` only takes effect when `encrypt = false`
  - Delete target: shows error toast if server returns 409
  - Test connection: shows `{ success, message }` response — render message text beneath the success/failure indicator so users get actionable detail (e.g. "Bucket not found", "Auth failed", "Connection refused") not just a red/green icon
  - Use CSS variables for all colors/backgrounds/borders via `style={}` props, matching AddonManager.tsx — **not** hardcoded Tailwind color classes, so all custom themes work:
    - Containers: `style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}`
    - Sub-headers/rows: `style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-secondary)' }}`
    - Primary text: `style={{ color: 'var(--text-primary)' }}`
    - Secondary/muted text: `style={{ color: 'var(--text-secondary)' }}` / `var(--text-muted)` / `var(--text-faint)`
    - Available variables: `--bg-primary`, `--bg-secondary`, `--bg-tertiary`, `--bg-card`, `--bg-hover`, `--border-primary`, `--border-secondary`, `--text-primary`, `--text-secondary`, `--text-muted`, `--text-faint`
  - Structural/spacing Tailwind classes are fine (`rounded-xl`, `flex`, `gap-`, `p-`, `px-`, `py-`, `items-center`, etc.) — only color/background/border use CSS vars
  - Container structure: `rounded-xl border overflow-hidden` on the card, `px-6 py-4 border-b` for section headers — matching AddonManager.tsx
  - Modal (Add/Edit Target) uses inline styles matching BackupPanel restore modal: `position: fixed, inset: 0, zIndex: 9999, background: rgba(0,0,0,0.5), backdropFilter: blur(4px)` backdrop with inner `maxWidth: 440, borderRadius: 16`
  - Use `useToast()` from `'../shared/Toast'` for notifications
  - Use lucide-react icons
  - No `dark:` Tailwind variants — those only handle two themes; CSS vars handle all themes
  - **RTL safety**: use logical Tailwind classes throughout — `ms-` / `me-` / `ps-` / `pe-` instead of `ml-` / `mr-` / `pl-` / `pr-`; avoid hardcoded `left`/`right` in any inline styles; verify modal layout with `dir="rtl"` applied (TREK ships Arabic with full RTL)

Modify:
- `client/src/pages/AdminPage.tsx`
  - Add `{ id: 'storage', label: t('admin.tabs.storage') }` to tabs array — all existing tabs use `t('admin.tabs.X')`; hardcoded label strings are not acceptable here
  - Add `<StorageTargetsPanel />` in the storage tab render branch
  - In Settings tab — add "Upload Storage" subsection:
    - "Use same target for all uploads" dropdown at the top; selecting a value calls `PUT /api/storage/assignments` for all four upload purposes at once
    - Four individual per-purpose dropdowns below it (photos, files, covers, avatars); backup has its own separate dropdown above the upload section
    - All dropdowns list configured targets + "Local (built-in)"
  - **RTL safety**: same logical class rules apply here (see StorageTargetsPanel note above)

Modify:
- `client/src/components/Admin/BackupPanel.tsx`
  - In backup list rows — add a source badge rendering `entry.targetName` from the list response directly (server resolves the name; no extra targets fetch needed in this component)
  - Show active backup storage target name in the manual backup section header

## Phase 10 — API Client

Modify:
- `client/src/api/client.ts` (or equivalent)
  - Add `storageTargetsApi`: `list`, `create`, `update`, `delete`, `testConnection`
  - Add `storageAssignmentsApi`: `list`, `updateAssignment`

## Phase 11 — i18n Keys

Modify translation files (all 12 locales — `ar`, `br`, `cs`, `de`, `en`, `es`, `fr`, `hu`, `it`, `nl`, `ru`, `zh`) with the following keys (English values shown). **Every key must be explicitly added to every locale file** — do not assume non-English locales inherit from `en.ts`; each file is a standalone object and missing keys silently fall back to the key string at runtime.

For non-English locales, copy the English value as a placeholder if a translation is not immediately available — the goal is to ensure no locale throws a missing-key warning at runtime:

```
admin.tabs.storage                       = "Storage"
storage.tab.label                        = "Storage"
storage.targets.title                    = "Storage Targets"
storage.targets.empty                    = "No storage targets configured"
storage.targets.add                      = "Add Target"
storage.target.type.s3                   = "S3"
storage.target.type.local                = "Local (built-in)"
storage.target.badge.local               = "Local"
storage.target.test                      = "Test Connection"
storage.target.test.success              = "Connection successful"
storage.target.test.failure              = "Connection failed: {message}"
storage.target.delete.conflict           = "Cannot delete — target is in use by one or more assignments"
storage.form.name                        = "Name"
storage.form.type                        = "Type"
storage.form.endpoint                    = "Endpoint"
storage.form.bucket                      = "Bucket"
storage.form.region                      = "Region"
storage.form.accessKeyId                 = "Access Key ID"
storage.form.secretAccessKey             = "Secret Access Key"
storage.form.pathPrefix                  = "Path Prefix"
storage.form.usePresignedUrls            = "Use presigned URLs"
storage.form.usePresignedUrls.hint       = "Only enable if your S3 endpoint is publicly reachable from browsers"
storage.form.usePresignedUrls.encrypted  = "Presigned URL serving is bypassed when encryption is enabled — files are decrypted and streamed through the server"
storage.form.encrypt                     = "Encrypt all files at rest (AES-256-GCM)"
storage.assignments.title                = "Storage Assignments"
storage.assignments.backup               = "Backup storage"
storage.assignments.photos               = "Photos storage"
storage.assignments.files                = "Files storage"
storage.assignments.covers               = "Covers storage"
storage.assignments.avatars              = "Avatars storage"
storage.assignments.allUploads           = "Use same target for all uploads"
storage.toast.targetCreated              = "Storage target created"
storage.toast.targetUpdated              = "Storage target updated"
storage.toast.targetDeleted              = "Storage target deleted"
storage.toast.targetError                = "Failed to save storage target"
storage.toast.assignmentSaved            = "Storage assignment saved"
storage.toast.assignmentError            = "Failed to save storage assignment"
```

## Phase 12 — Helm Chart Updates

Kubernetes/Helm users bootstrap storage via the same `STORAGE_*` env vars. The chart must expose them so values can be set in `values.yaml` and flow into the container via its ConfigMap.

Modify `chart/values.yaml` — add a commented-out storage bootstrap block inside the `env:` section, following the existing pattern for `ALLOWED_ORIGINS` and `ALLOW_INTERNAL_NETWORK`:

```yaml
  # Storage target bootstrap (optional — see docs/storage.md for full details)
  # First-boot only: if a target with the same name already exists it is not overwritten.
  # S3 target
  # STORAGE_S3_NAME: "S3"
  # STORAGE_S3_ENDPOINT: ""        # required to enable S3 bootstrap
  # STORAGE_S3_BUCKET: ""
  # STORAGE_S3_REGION: ""
  # STORAGE_S3_ACCESS_KEY: ""
  # STORAGE_S3_SECRET_KEY: ""
  # STORAGE_S3_PATH_PREFIX: ""     # optional
  # STORAGE_S3_ENCRYPT: "false"    # optional, default false
  # STORAGE_S3_PRESIGNED_URLS: "false" # optional, default false
  # Assignments
  # STORAGE_ASSIGN_BACKUP: "local"  # s3 | local
  # STORAGE_ASSIGN_PHOTOS: "local"
  # STORAGE_ASSIGN_FILES: "local"
  # STORAGE_ASSIGN_COVERS: "local"
  # STORAGE_ASSIGN_AVATARS: "local"
```

All STORAGE_* vars, including `STORAGE_S3_SECRET_KEY`, go in `env:` (ConfigMap) — that is what the chart supports. The `secretEnv:` section only handles `ENCRYPTION_KEY` via a hardcoded `secretKeyRef` in `deployment.yaml`; putting storage credentials there would write them to the Kubernetes Secret but they would never reach the container as env vars. For proper secret handling in production, use an external mechanism (External Secrets Operator, Sealed Secrets, Vault Agent, etc.) outside the scope of this chart.

Modify `chart/templates/configmap.yaml` — append conditional blocks for all STORAGE_* vars (including `STORAGE_S3_SECRET_KEY`) at the end of the `data:` section, following the exact `{{- if }}` pattern used for `ALLOWED_ORIGINS`:

```yaml
  {{- if .Values.env.STORAGE_S3_NAME }}
  STORAGE_S3_NAME: {{ .Values.env.STORAGE_S3_NAME | quote }}
  {{- end }}
  {{- if .Values.env.STORAGE_S3_ENDPOINT }}
  STORAGE_S3_ENDPOINT: {{ .Values.env.STORAGE_S3_ENDPOINT | quote }}
  {{- end }}
  {{- if .Values.env.STORAGE_S3_BUCKET }}
  STORAGE_S3_BUCKET: {{ .Values.env.STORAGE_S3_BUCKET | quote }}
  {{- end }}
  {{- if .Values.env.STORAGE_S3_REGION }}
  STORAGE_S3_REGION: {{ .Values.env.STORAGE_S3_REGION | quote }}
  {{- end }}
  {{- if .Values.env.STORAGE_S3_ACCESS_KEY }}
  STORAGE_S3_ACCESS_KEY: {{ .Values.env.STORAGE_S3_ACCESS_KEY | quote }}
  {{- end }}
  {{- if .Values.env.STORAGE_S3_SECRET_KEY }}
  STORAGE_S3_SECRET_KEY: {{ .Values.env.STORAGE_S3_SECRET_KEY | quote }}
  {{- end }}
  {{- if .Values.env.STORAGE_S3_PATH_PREFIX }}
  STORAGE_S3_PATH_PREFIX: {{ .Values.env.STORAGE_S3_PATH_PREFIX | quote }}
  {{- end }}
  {{- if .Values.env.STORAGE_S3_ENCRYPT }}
  STORAGE_S3_ENCRYPT: {{ .Values.env.STORAGE_S3_ENCRYPT | quote }}
  {{- end }}
  {{- if .Values.env.STORAGE_S3_PRESIGNED_URLS }}
  STORAGE_S3_PRESIGNED_URLS: {{ .Values.env.STORAGE_S3_PRESIGNED_URLS | quote }}
  {{- end }}
  {{- if .Values.env.STORAGE_ASSIGN_BACKUP }}
  STORAGE_ASSIGN_BACKUP: {{ .Values.env.STORAGE_ASSIGN_BACKUP | quote }}
  {{- end }}
  {{- if .Values.env.STORAGE_ASSIGN_PHOTOS }}
  STORAGE_ASSIGN_PHOTOS: {{ .Values.env.STORAGE_ASSIGN_PHOTOS | quote }}
  {{- end }}
  {{- if .Values.env.STORAGE_ASSIGN_FILES }}
  STORAGE_ASSIGN_FILES: {{ .Values.env.STORAGE_ASSIGN_FILES | quote }}
  {{- end }}
  {{- if .Values.env.STORAGE_ASSIGN_COVERS }}
  STORAGE_ASSIGN_COVERS: {{ .Values.env.STORAGE_ASSIGN_COVERS | quote }}
  {{- end }}
  {{- if .Values.env.STORAGE_ASSIGN_AVATARS }}
  STORAGE_ASSIGN_AVATARS: {{ .Values.env.STORAGE_ASSIGN_AVATARS | quote }}
  {{- end }}
```

All STORAGE_* vars go in `env:` (ConfigMap). The chart does not support injecting arbitrary Kubernetes Secret keys into the container — `deployment.yaml` only wires `ENCRYPTION_KEY` by name. For production-grade secret handling of `STORAGE_S3_SECRET_KEY`, users need an external mechanism (ESO, Sealed Secrets, etc.) outside this chart.

Modify `chart/README.md` — add a **Storage Configuration** section after the existing configuration section, documenting:
- The env bootstrap is first-boot-only and idempotent
- All STORAGE_* vars (including credentials) go in `env:` (ConfigMap) — the chart only injects `ENCRYPTION_KEY` from the Kubernetes Secret; storage credentials placed in `secretEnv:` would reach the Secret object but never the container; for production secret management use ESO or Sealed Secrets
- Reference `docs/storage.md` for full env var reference and examples

---

## Open Questions

- [x] Should there be a "Use same target for all uploads" convenience toggle in the Settings tab that sets photos/files/covers/avatars all at once? (backup intentionally excluded) → **Yes**

---

## File Inventory

| File | Action |
|------|--------|
| `server/src/storage/types.ts` | Create |
| `server/src/storage/crypto.ts` | Create |
| `server/src/storage/local.ts` | Create |
| `server/src/storage/s3.ts` | Create |
| `server/src/storage/encrypted.ts` | Create |
| `server/src/storage/factory.ts` | Create |
| `server/src/routes/storageTargets.ts` | Create |
| `server/src/routes/storageAssignments.ts` | Create |
| `server/src/storage/bootstrap.ts` | Create (or inline into `factory.ts`) |
| `server/src/routes/fileProxy.ts` | Create |
| `server/src/index.ts` | Modify |
| `server/src/db/migrations.ts` | Modify |
| `server/src/routes/backup.ts` | Modify |
| `server/src/scheduler.ts` | Modify |
| `client/src/components/Admin/StorageTargetsPanel.tsx` | Create |
| `client/src/pages/AdminPage.tsx` | Modify |
| `client/src/components/Admin/BackupPanel.tsx` | Modify |
| `client/src/api/client.ts` | Modify |
| `docs/storage.md` | Create (env bootstrap Docker Compose example; preferred over adding to root README.md) |
| `chart/values.yaml` | Modify (add commented-out STORAGE_* entries under `env:`) |
| `chart/templates/configmap.yaml` | Modify (add conditional blocks for each STORAGE_* env var) |
| `chart/README.md` | Modify (add storage configuration section) |
| Translation files (all 12 locales) | Modify |
