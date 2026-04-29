/**
 * CloudflareAccess — Zero Trust SSO policy in front of atlas.skafld.com.
 *
 * Creates:
 *   - A Cloudflare Access application bound to the Atlas domain
 *   - A policy allowing only specific email addresses
 *
 * Effect: visitors must authenticate via Cloudflare's IdP (One-time PIN by
 * default; can be upgraded to Google/Okta/etc.) before any request reaches
 * Atlas. This is layered on top of Atlas's own auth — both must succeed.
 *
 * Note on internal traffic: Cloudflare Access intercepts at the edge. Server-
 * to-server calls (e.g., the MCP endpoint, webhooks) require Service Tokens
 * which bypass the email auth. Configure those manually via dashboard if
 * needed; not modeled here since Atlas is single-instance internal.
 */

import * as pulumi from "@pulumi/pulumi";
import * as cloudflare from "@pulumi/cloudflare";

export interface CloudflareAccessArgs {
  accountId: string;
  zoneId: pulumi.Input<string>;
  appName: string;
  appDomain: string;
  authorizedEmails: string[];
  sessionDuration: string;
}

export class CloudflareAccess extends pulumi.ComponentResource {
  public readonly appId: pulumi.Output<string>;

  constructor(
    name: string,
    args: CloudflareAccessArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super("skafld:atlas:CloudflareAccess", name, args, opts);

    // -------------------------------------------------------------------------
    // Access application
    // -------------------------------------------------------------------------

    const app = new cloudflare.ZeroTrustAccessApplication(
      `${name}-app`,
      {
        accountId: args.accountId,
        name: args.appName,
        domain: args.appDomain,
        type: "self_hosted",
        sessionDuration: args.sessionDuration,
        autoRedirectToIdentity: false,
        skipInterstitial: false,
        appLauncherVisible: true,
      },
      { parent: this },
    );

    // -------------------------------------------------------------------------
    // Policy: allow listed emails
    // -------------------------------------------------------------------------

    new cloudflare.ZeroTrustAccessPolicy(
      `${name}-policy`,
      {
        accountId: args.accountId,
        applicationId: app.id,
        name: "Allow Skafld team",
        decision: "allow",
        precedence: 1,
        includes: [
          {
            emails: args.authorizedEmails,
          },
        ],
      },
      { parent: this, dependsOn: [app] },
    );

    this.appId = app.id;
    this.registerOutputs({ appId: this.appId });
  }
}
