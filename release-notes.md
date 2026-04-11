# Release Notes

## v2.9.11

### Bug Fixes

- **OIDC-only mode: resolved login/logout loop** — When password authentication is disabled, logging out no longer triggers an immediate re-authentication loop. After logout, users land on the login page and must manually click "Sign in with {provider}" to start the OIDC flow. Also fixed a secondary loop that could occur on the OIDC callback page under React 18 StrictMode, where the auth code exchange would be interrupted before completing, causing the app to redirect back to the identity provider instead of landing on the dashboard. (#491)
