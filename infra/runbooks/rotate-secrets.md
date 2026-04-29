# Secret Rotation Runbook — Skafld.Atlas

When and how to rotate secrets.

## Cadence

SecretRotation cadenceTrigger`ENCRYPTION_KEY`Annually, or on suspected compromiseHigh effort — see special procedure below`JWT_SECRET`Quarterly, or on suspected compromiseLogs out all users (low impact for 2 users)OIDC client secretsWhen the IdP rotates themExternal event`RAILWAY_TOKEN`, `CLOUDFLARE_API_TOKEN`, `DOPPLER_TOKEN`, `GITHUB_TOKEN` (CI tokens)Annually, or on offboardingUpdate GitHub Actions secrets after rotationR2 access keysManaged by Pulumi — rotate via `pulumi up` after editing the resourcePulumi handles the swap atomically

## Standard rotation (most secrets)

For everything except `ENCRYPTION_KEY`:

1. Generate the new value (`openssl rand -hex 32` for raw secrets, or use the provider's "generate new" UI).
2. Update the secret in Doppler (`skafld-atlas` / `prd`).
3. Save. Railway redeploys automatically (\~30s).
4. Verify: `railway logs --service atlas | tail -20`. Look for clean startup.
5. If the secret was used by external systems (CI tokens, OIDC), update those too.
6. Note the rotation in `runbooks/rotation-log.md`.

## ENCRYPTION_KEY rotation (special — high risk)

**Why this is different:** `ENCRYPTION_KEY` encrypts data at rest. Changing it without re-encrypting existing data = data is unreadable.

The full procedure is automated in `infra/scripts/rotate-encryption-key.sh` and walks through these steps with confirmations:

1. **Snapshot** current state via `volume-snapshot.sh`. Keeps a known-good rollback point.
2. **Generate** the new key.
3. **Add** the new key to Doppler as `ENCRYPTION_KEY_NEW` (alongside the old one). Atlas must support both during transition.
4. **Migrate** — run the Atlas-side re-encryption script that reads with old key, writes with new key.
5. **Verify** all encrypted fields are readable with new key.
6. **Promote** — update `ENCRYPTION_KEY` to the new value, delete `ENCRYPTION_KEY_NEW`.
7. **Monitor** logs for 24 hours; keep snapshot for 7 days minimum.

**Atlas-side requirement:** The Atlas server must support reading two keys simultaneously during step 3-5. If it doesn't (current implementation), do NOT start a rotation. Add multi-key support first as a code change, deploy, then rotate.

To check whether Atlas supports it: look in `server/lib/encryption.js` (or wherever encryption lives) for logic that tries `ENCRYPTION_KEY_NEW` first and falls back to `ENCRYPTION_KEY`. If absent, that's the prerequisite work.

## What gets rotated when someone leaves

If Mike or any other team member with access leaves:

- \[ \] Remove their email from Cloudflare Access policy (`infra/pulumi/index.ts` → `authorizedEmails`, then `pulumi up`)
- \[ \] Remove their GitHub access to the repo
- \[ \] Remove their Doppler access
- \[ \] Remove their Railway account from the team
- \[ \] Rotate `JWT_SECRET` (logs them out of any active sessions)
- \[ \] Rotate any shared CI tokens they had access to
- \[ \] Optionally rotate `ENCRYPTION_KEY` if they had production access and the relationship is bad

## Rotation log template

Add an entry to `runbooks/rotation-log.md` after each rotation:

```
## 2026-04-28 — JWT_SECRET rotation
- Reason: scheduled quarterly
- Performed by: Charles
- Verified: logged in successfully on new session at 14:32 UTC
- No issues
```
