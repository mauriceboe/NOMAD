# Password Reset

<!-- TODO: screenshot: admin user edit form showing forced password change option -->

## Self-service reset

TREK does not have a self-service "Forgot password?" email flow. There is no password-reset email or reset-token mechanism in the application. If you have forgotten your password you must contact your admin for a reset.

## Admin-initiated reset

An admin can set a new password for any user directly from the admin panel (**Admin → Users**). The admin enters a new password for the account, which is saved immediately — no email is required. The admin can also enable the **"Force password change on next login"** flag so the user is prompted to choose their own password the next time they sign in.

See [Admin-Users-and-Invites](Admin-Users-and-Invites) for step-by-step instructions.

## Password requirements

When choosing a new password (whether via the forced-change prompt or the normal **Settings → Security** page) the password must:

- Be at least **8 characters** long
- Contain at least one **uppercase letter**
- Contain at least one **lowercase letter**
- Contain at least one **number**
- Contain at least one **special character**
- Not be a commonly used password

## Rate limiting

Password change requests are rate-limited per IP address to prevent abuse.

## OIDC accounts

If you signed up via SSO and have no local password set, there is no local password to reset. Continue using [OIDC-SSO](OIDC-SSO) to sign in.

---

**See also:** [Login-and-Registration](Login-and-Registration) · [Admin-Users-and-Invites](Admin-Users-and-Invites) · [OIDC-SSO](OIDC-SSO)
