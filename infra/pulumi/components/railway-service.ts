/**
 * RailwayServiceConfig — Pulumi ComponentResource for Railway service config.
 *
 * IMPORTANT: Railway has no official Pulumi provider as of 2026-04. This
 * component does NOT create the Railway service itself. The service must be
 * created once via the Railway CLI during bootstrap (see scripts/
 * bootstrap-railway.sh), after which Pulumi manages its configuration via
 * the Railway GraphQL API through pulumi.Command resources.
 *
 * What this component manages:
 *   - Environment variables on the service (PUT via Railway GraphQL)
 *   - Custom domain attachment
 *   - Volume size declarations (volumes themselves are created at bootstrap;
 *     resizing is supported)
 *
 * What this component does NOT manage:
 *   - Service creation / deletion (manual via Railway CLI)
 *   - Volume creation / deletion (manual via Railway CLI)
 *   - Project creation (manual via Railway CLI)
 *
 * Why this split: Railway's API surface is limited and a full provider would
 * be more work than it's worth for an internal tool. The bootstrap script
 * runs once per environment; ongoing config drift is what Pulumi watches.
 *
 * Migration path: when Railway ships a Pulumi provider (or a community one
 * matures), this component gets replaced with proper resources and the
 * bootstrap script is retired.
 */

import * as pulumi from "@pulumi/pulumi";
import { local } from "@pulumi/command";

export interface VolumeConfig {
  name: string;
  mountPath: string;
  sizeGb: number;
}

export interface RailwayServiceConfigArgs {
  serviceName: string;
  customDomain: string;
  volumes: VolumeConfig[];
  pulumiManagedEnv: { [key: string]: pulumi.Input<string> };
  healthcheckPath: string;
}

export class RailwayServiceConfig extends pulumi.ComponentResource {
  public readonly railwayHostname: pulumi.Output<string>;
  public readonly serviceId: pulumi.Output<string>;

  constructor(
    name: string,
    args: RailwayServiceConfigArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super("skafld:atlas:RailwayServiceConfig", name, args, opts);

    // Railway token comes from env. The bootstrap script verifies it.
    const railwayToken = process.env.RAILWAY_TOKEN;
    if (!railwayToken) {
      throw new Error("RAILWAY_TOKEN environment variable is required");
    }

    // -------------------------------------------------------------------------
    // Look up the service ID from Railway by name. The service was created
    // during bootstrap; we read its current ID.
    // -------------------------------------------------------------------------

    const lookupService = new local.Command(
      `${name}-lookup`,
      {
        create: pulumi.interpolate`./scripts/railway-graphql.sh lookup-service '${args.serviceName}'`,
        triggers: [args.serviceName],
        environment: {
          RAILWAY_TOKEN: railwayToken,
        },
      },
      { parent: this },
    );

    this.serviceId = lookupService.stdout.apply((s) => s.trim());

    // -------------------------------------------------------------------------
    // Set environment variables on the service.
    // -------------------------------------------------------------------------

    // Build a stable JSON object of env vars. Pulumi will detect changes and
    // re-run the upsert script when this changes.
    const envJson = pulumi
      .all(args.pulumiManagedEnv)
      .apply((env) => JSON.stringify(env));

    new local.Command(
      `${name}-env`,
      {
        create: pulumi.interpolate`./scripts/railway-graphql.sh upsert-env ${this.serviceId} '${envJson}'`,
        update: pulumi.interpolate`./scripts/railway-graphql.sh upsert-env ${this.serviceId} '${envJson}'`,
        triggers: [envJson],
        environment: {
          RAILWAY_TOKEN: railwayToken,
        },
      },
      { parent: this, dependsOn: [lookupService] },
    );

    // -------------------------------------------------------------------------
    // Attach custom domain. Idempotent — the script checks before creating.
    // -------------------------------------------------------------------------

    new local.Command(
      `${name}-domain`,
      {
        create: pulumi.interpolate`./scripts/railway-graphql.sh attach-domain ${this.serviceId} '${args.customDomain}'`,
        triggers: [args.customDomain],
        environment: {
          RAILWAY_TOKEN: railwayToken,
        },
      },
      { parent: this, dependsOn: [lookupService] },
    );

    // -------------------------------------------------------------------------
    // Volume size enforcement. The volumes themselves were created at bootstrap.
    // This step verifies their sizes match the declared config and resizes
    // upward if needed. Downsizing is NOT supported (would lose data).
    // -------------------------------------------------------------------------

    args.volumes.forEach((vol) => {
      new local.Command(
        `${name}-volume-${vol.name}`,
        {
          create: pulumi.interpolate`./scripts/railway-graphql.sh ensure-volume ${this.serviceId} '${vol.name}' '${vol.mountPath}' ${vol.sizeGb}`,
          update: pulumi.interpolate`./scripts/railway-graphql.sh ensure-volume ${this.serviceId} '${vol.name}' '${vol.mountPath}' ${vol.sizeGb}`,
          triggers: [vol.name, vol.mountPath, vol.sizeGb.toString()],
          environment: {
            RAILWAY_TOKEN: railwayToken,
          },
        },
        { parent: this, dependsOn: [lookupService] },
      );
    });

    // -------------------------------------------------------------------------
    // Get the Railway-provided hostname for DNS.
    // -------------------------------------------------------------------------

    const getHostname = new local.Command(
      `${name}-hostname`,
      {
        create: pulumi.interpolate`./scripts/railway-graphql.sh get-hostname ${this.serviceId}`,
        triggers: [this.serviceId],
        environment: {
          RAILWAY_TOKEN: railwayToken,
        },
      },
      { parent: this, dependsOn: [lookupService] },
    );

    this.railwayHostname = getHostname.stdout.apply((s) => s.trim());

    this.registerOutputs({
      railwayHostname: this.railwayHostname,
      serviceId: this.serviceId,
    });
  }
}
