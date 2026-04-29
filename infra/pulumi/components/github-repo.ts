/**
 * GitHubRepoConfig — manages branch protection and Actions secrets for an
 * existing GitHub repo.
 *
 * Does NOT create the repo itself — the repo is assumed to exist already
 * (created when the project was initialized). This component configures it.
 *
 * What gets configured:
 *   - Branch protection on `main` (require PR, require status checks)
 *   - Actions secrets needed for CI workflows
 *   - Repository environments (prod) with deployment protection rules
 */

import * as pulumi from "@pulumi/pulumi";
import * as github from "@pulumi/github";

export interface GitHubRepoConfigArgs {
  owner: string;
  repository: string;
  protectMain: boolean;
}

export class GitHubRepoConfig extends pulumi.ComponentResource {
  public readonly status: pulumi.Output<string>;

  constructor(
    name: string,
    args: GitHubRepoConfigArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super("skafld:atlas:GitHubRepoConfig", name, args, opts);

    // -------------------------------------------------------------------------
    // Branch protection on main
    // -------------------------------------------------------------------------

    if (args.protectMain) {
      new github.BranchProtection(
        `${name}-main-protection`,
        {
          repositoryId: args.repository,
          pattern: "main",
          requiredStatusChecks: [
            {
              strict: true,
              contexts: ["pulumi-preview"],
            },
          ],
          requiredPullRequestReviews: [
            {
              dismissStaleReviews: true,
              requiredApprovingReviewCount: 1,
              requireCodeOwnerReviews: false,
            },
          ],
          enforceAdmins: false, // allow admins to bypass for emergencies
          allowsDeletions: false,
          allowsForcePushes: false,
        },
        { parent: this },
      );
    }

    // -------------------------------------------------------------------------
    // Repository environment for prod deployments
    // -------------------------------------------------------------------------
    // The 'prod' environment requires manual approval before pulumi-deploy
    // runs against it. This is a safety net for production changes.

    const prodEnv = new github.RepositoryEnvironment(
      `${name}-prod-env`,
      {
        environment: "prod",
        repository: args.repository,
        reviewers: [
          {
            users: [], // populated manually via dashboard - the user IDs aren't worth round-tripping
          },
        ],
        deploymentBranchPolicy: {
          protectedBranches: true,
          customBranchPolicies: false,
        },
      },
      { parent: this },
    );

    // -------------------------------------------------------------------------
    // Actions secrets
    // -------------------------------------------------------------------------
    // These are the secrets GitHub Actions needs to run pulumi up. They must
    // be set manually once via:
    //   gh secret set PULUMI_ACCESS_TOKEN --repo skafld-studio/skafld-atlas
    //
    // We do NOT manage them with Pulumi because chicken-and-egg: Pulumi needs
    // these secrets to run, so it can't manage them. This component just
    // documents what should exist.

    this.status = pulumi.output(
      "Branch protection + prod environment configured. " +
        "Ensure GitHub secrets are set: PULUMI_ACCESS_TOKEN, RAILWAY_TOKEN, " +
        "CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, DOPPLER_TOKEN, GITHUB_TOKEN.",
    );

    this.registerOutputs({ status: this.status });
  }
}
