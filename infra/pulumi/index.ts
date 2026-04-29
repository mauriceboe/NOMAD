/**
 * Skafld.Atlas — Pulumi Infrastructure
 *
 * Provisions all infrastructure for the Atlas internal travel/trip planner.
 *
 * Architecture:
 *   - Railway hosts the monolithic Express container (single replica)
 *   - Two persistent volumes: /app/data (SQLite + secrets) and /app/uploads (user files)
 *   - Cloudflare R2 stores off-site backups
 *   - Cloudflare DNS + Access fronts the service with SSO
 *   - Doppler is the source of truth for runtime secrets
 *   - GitHub repo configuration enforces branch protection and CI secrets
 *
 * IMPORTANT: Railway has no official Pulumi provider. The Railway service
 * itself is bootstrapped manually once via the Railway CLI (see infra/scripts/
 * bootstrap-railway.sh) and then "imported" conceptually — Pulumi tracks
 * configuration about it (env vars, domain) but the service lifecycle is
 * managed via the Railway CLI invoked from CI. This is documented in
 * components/railway-service.ts.
 */

import * as pulumi from "@pulumi/pulumi";
import * as cloudflare from "@pulumi/cloudflare";
import * as github from "@pulumi/github";
import * as doppler from "@pulumiverse/doppler";

import { BackupBucket } from "./components/backup-bucket";
import { GitHubRepoConfig } from "./components/github-repo";
import { CloudflareAccess } from "./components/cloudflare-access";
import { RailwayServiceConfig } from "./components/railway-service";

// -----------------------------------------------------------------------------
// Config
// -----------------------------------------------------------------------------

const config = new pulumi.Config();
const stack = pulumi.getStack();

const domain = config.require("domain");
const cloudflareZone = config.require("cloudflareZone");
const githubOwner = config.require("githubOwner");
const githubRepo = config.require("githubRepo");
const dopplerProject = config.require("dopplerProject");
const dopplerConfig = config.require("dopplerConfig");
const backupBucketName = config.require("backupBucketName");
const authorizedEmails = config.requireObject<string[]>("authorizedEmails");
const dataVolumeSize = config.requireNumber("dataVolumeSize");
const uploadsVolumeSize = config.requireNumber("uploadsVolumeSize");

// Cloudflare account ID is needed for R2 + Access. Pulled from env to avoid
// committing it to the stack config (it's not exactly secret, but cleaner).
const cloudflareAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
if (!cloudflareAccountId) {
  throw new Error("CLOUDFLARE_ACCOUNT_ID environment variable is required");
}

// -----------------------------------------------------------------------------
// Cloudflare zone lookup
// -----------------------------------------------------------------------------

const zone = cloudflare.getZoneOutput({ name: cloudflareZone });

// -----------------------------------------------------------------------------
// 1. GitHub repo configuration
// -----------------------------------------------------------------------------
// Repo is assumed to exist already. We manage branch protection and Actions
// secrets so the repo enforces our deployment rules.

const repoConfig = new GitHubRepoConfig("atlas-repo", {
  owner: githubOwner,
  repository: githubRepo,
  protectMain: true,
});

// -----------------------------------------------------------------------------
// 2. Doppler project + service token
// -----------------------------------------------------------------------------
// The Doppler project itself is created manually during bootstrap (you enter
// the actual secret values there). Pulumi creates a service token that
// Railway uses to fetch secrets at runtime.

const dopplerSvcToken = new doppler.ServiceToken("atlas-railway-token", {
  project: dopplerProject,
  config: dopplerConfig,
  name: `railway-${stack}`,
  access: "read",
});

// -----------------------------------------------------------------------------
// 3. Cloudflare R2 backup bucket
// -----------------------------------------------------------------------------

const backups = new BackupBucket("atlas-backups", {
  accountId: cloudflareAccountId,
  bucketName: backupBucketName,
  retention: {
    dailyDays: 30,
    weeklyDays: 90,
    monthlyDays: 365,
  },
});

// -----------------------------------------------------------------------------
// 4. Railway service configuration
// -----------------------------------------------------------------------------
// The Railway service itself is provisioned via the Railway CLI in the
// bootstrap script. This component manages the configuration we want
// expressed as code: env vars, custom domain, volume sizes.
//
// Env vars are sourced from Doppler at runtime via the Railway-Doppler
// integration. We only declare here the env vars that come from Pulumi
// outputs (R2 credentials, etc.) — everything else lives in Doppler.

const railwayService = new RailwayServiceConfig("atlas", {
  serviceName: "atlas",
  customDomain: domain,
  volumes: [
    { name: "atlas-data", mountPath: "/app/data", sizeGb: dataVolumeSize },
    { name: "atlas-uploads", mountPath: "/app/uploads", sizeGb: uploadsVolumeSize },
  ],
  // Env vars Pulumi knows about and injects.
  // Doppler-managed secrets (ENCRYPTION_KEY, JWT_SECRET, etc.) are NOT here.
  pulumiManagedEnv: {
    NODE_ENV: "production",
    PORT: "3000",
    FORCE_HTTPS: "true",
    TRUST_PROXY: "1",
    LOG_LEVEL: "info",
    TZ: "America/Los_Angeles",
    ALLOWED_ORIGINS: pulumi.interpolate`https://${domain}`,
    APP_URL: pulumi.interpolate`https://${domain}`,
    // R2 credentials for the backup script inside the container
    BACKUP_R2_BUCKET: backups.bucketName,
    BACKUP_R2_ACCESS_KEY_ID: backups.accessKeyId,
    BACKUP_R2_SECRET_ACCESS_KEY: backups.secretAccessKey,
    BACKUP_R2_ENDPOINT: backups.endpoint,
    // Doppler integration
    DOPPLER_TOKEN: dopplerSvcToken.key,
  },
  healthcheckPath: "/api/health",
});

// -----------------------------------------------------------------------------
// 5. Cloudflare DNS
// -----------------------------------------------------------------------------
// CNAME from atlas.skafld.com to Railway's domain target.
// Railway provides the actual hostname — captured in railwayService output.

const dnsRecord = new cloudflare.Record("atlas-dns", {
  zoneId: zone.zoneId,
  name: domain.replace(`.${cloudflareZone}`, ""),
  type: "CNAME",
  content: railwayService.railwayHostname,
  proxied: true,
  ttl: 1, // 1 = automatic when proxied
  comment: "Managed by Pulumi (skafld-atlas)",
});

// -----------------------------------------------------------------------------
// 6. Cloudflare Access policy (SSO in front of the app)
// -----------------------------------------------------------------------------

const access = new CloudflareAccess("atlas-access", {
  accountId: cloudflareAccountId,
  zoneId: zone.zoneId,
  appName: "Skafld Atlas",
  appDomain: domain,
  authorizedEmails: authorizedEmails,
  sessionDuration: "24h",
});

// -----------------------------------------------------------------------------
// Outputs
// -----------------------------------------------------------------------------

export const url = pulumi.interpolate`https://${domain}`;
export const railwayHostname = railwayService.railwayHostname;
export const backupBucket = backups.bucketName;
export const dopplerServiceToken = pulumi.secret(dopplerSvcToken.key);
export const repoConfigStatus = repoConfig.status;
export const accessAppId = access.appId;
