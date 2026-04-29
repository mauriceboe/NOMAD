/**
 * BackupBucket — Cloudflare R2 bucket for off-site backups.
 *
 * Creates:
 *   - An R2 bucket (managed by Pulumi)
 *
 * Reads from Pulumi config (manually populated after one-time setup):
 *   - skafld-atlas:r2AccessKeyId       (set via `pulumi config set`)
 *   - skafld-atlas:r2SecretAccessKey   (set via `pulumi config set --secret`)
 *
 * NOT managed here (manual via Cloudflare dashboard — see
 * infra/scripts/bootstrap-cloudflare.sh):
 *   - Lifecycle rules (object expiration by prefix)
 *   - S3-compatible access keys
 *
 * Why split: as of @pulumi/cloudflare 5.49.x, the provider does not export
 * R2BucketLifecycle or R2AccessKey resources. Cloudflare's API supports both,
 * but until the Pulumi provider catches up, these are configured once via
 * the dashboard and treated as static infrastructure.
 *
 * Operational impact: drift detection won't catch changes to lifecycle rules
 * or access keys. Mitigation: the bootstrap script verifies their existence
 * after setup; quarterly DR drills exercise restore which depends on them.
 *
 * Backup strategy (enforced by lifecycle rules in Cloudflare dashboard):
 *   - daily/   keep 30 days
 *   - weekly/  keep 90 days
 *   - monthly/ keep 365 days
 *
 * Naming convention assumed by the lifecycle rules and backup-now.sh:
 *   daily/YYYY-MM-DD-HHMMSS.tar.gz
 *   weekly/YYYY-Www.tar.gz
 *   monthly/YYYY-MM.tar.gz
 */

import * as pulumi from "@pulumi/pulumi";
import * as cloudflare from "@pulumi/cloudflare";

export interface BackupBucketArgs {
  accountId: string;
  bucketName: string;
  retention: {
    dailyDays: number;
    weeklyDays: number;
    monthlyDays: number;
  };
}

export class BackupBucket extends pulumi.ComponentResource {
  public readonly bucketName: pulumi.Output<string>;
  public readonly endpoint: pulumi.Output<string>;
  public readonly accessKeyId: pulumi.Output<string>;
  public readonly secretAccessKey: pulumi.Output<string>;

  constructor(
    name: string,
    args: BackupBucketArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super("skafld:atlas:BackupBucket", name, args, opts);

    // -------------------------------------------------------------------------
    // R2 bucket (Pulumi-managed)
    // -------------------------------------------------------------------------

    const bucket = new cloudflare.R2Bucket(
      `${name}-bucket`,
      {
        accountId: args.accountId,
        name: args.bucketName,
        location: "WNAM", // Western North America (close to us-west2 Railway region)
      },
      { parent: this },
    );

    // -------------------------------------------------------------------------
    // Access keys (manual — read from Pulumi config)
    // -------------------------------------------------------------------------
    // Set these once after running bootstrap-cloudflare.sh:
    //   pulumi config set skafld-atlas:r2AccessKeyId <value>
    //   pulumi config set --secret skafld-atlas:r2SecretAccessKey <value>

    const config = new pulumi.Config("skafld-atlas");
    const r2AccessKeyId = config.get("r2AccessKeyId") ?? "PENDING_BOOTSTRAP";
    const r2SecretAccessKey = config.getSecret("r2SecretAccessKey") ?? pulumi.secret("PENDING_BOOTSTRAP");

    if (r2AccessKeyId === "PENDING_BOOTSTRAP") {
      pulumi.log.warn(
        `${name}: r2AccessKeyId not set in config. Run bootstrap-cloudflare.sh, then set:\n` +
          `  pulumi config set skafld-atlas:r2AccessKeyId <value>\n` +
          `  pulumi config set --secret skafld-atlas:r2SecretAccessKey <value>`,
      );
    }

    // -------------------------------------------------------------------------
    // Lifecycle rules note
    // -------------------------------------------------------------------------
    // Lifecycle rules are configured manually in the Cloudflare dashboard.
    // We retain the retention config in args so the bootstrap script and
    // runbooks can reference a single source of truth.
    void args.retention; // currently informational only

    // -------------------------------------------------------------------------
    // Outputs
    // -------------------------------------------------------------------------

    this.bucketName = bucket.name;
    this.endpoint = pulumi.interpolate`https://${args.accountId}.r2.cloudflarestorage.com`;
    this.accessKeyId = pulumi.output(r2AccessKeyId);
    this.secretAccessKey = pulumi.output(r2SecretAccessKey);

    this.registerOutputs({
      bucketName: this.bucketName,
      endpoint: this.endpoint,
      accessKeyId: this.accessKeyId,
    });
  }
}
