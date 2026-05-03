# Internal Network Access

TREK makes outbound HTTP requests when you configure integrations such as Immich or Synology Photos. By default, it blocks requests to private and local IP ranges to prevent server-side request forgery (SSRF) attacks. You need to allow internal network access when those services are hosted on your LAN.

## Default behavior

All outbound requests go through an SSRF guard (`ssrfGuard.ts`). The guard resolves the hostname to an IP address before allowing the connection and blocks addresses in private ranges.

## Always blocked (no override possible)

These ranges are blocked regardless of any setting:

| Range | Description |
|---|---|
| `127.0.0.0/8`, `::1` | Loopback |
| `0.0.0.0/8` | Unspecified |
| `169.254.0.0/16`, `fe80::/10` | Link-local / cloud metadata endpoints |
| `::ffff:127.x.x.x`, `::ffff:169.254.x.x` | IPv4-mapped loopback and link-local |

## Blocked unless `ALLOW_INTERNAL_NETWORK=true`

| Range / Hostname | Description |
|---|---|
| `10.0.0.0/8` | RFC-1918 private |
| `172.16.0.0/12` | RFC-1918 private |
| `192.168.0.0/16` | RFC-1918 private |
| `100.64.0.0/10` | CGNAT / Tailscale shared address space |
| `fc00::/7` | IPv6 ULA |
| IPv4-mapped RFC-1918 variants | e.g. `::ffff:10.x`, `::ffff:192.168.x` |
| `*.local`, `*.internal` hostnames | mDNS / internal DNS suffixes (e.g. Docker service names, LAN hosts) |

The hostname `localhost` is not blocked at the hostname stage, but it resolves to `127.0.0.1` which is caught by the loopback rule above and is therefore always blocked.

`*.local` and `*.internal` hostnames are permitted when `ALLOW_INTERNAL_NETWORK=true` — the guard still resolves them to an IP and enforces all IP-level rules, so any such hostname that resolves to a loopback or link-local address remains blocked regardless.

## When to enable

Set `ALLOW_INTERNAL_NETWORK=true` when Immich, Synology Photos, or another integrated service is hosted on your local network and you need TREK to reach it.

See [Environment-Variables](Environment-Variables) for how to set environment variables.

> **Admin:** Set `ALLOW_INTERNAL_NETWORK=true` in [Environment-Variables](Environment-Variables) before configuring Immich or Synology on a LAN.

## DNS rebinding protection

Even with `ALLOW_INTERNAL_NETWORK=true`, TREK pins the DNS resolution to prevent rebinding attacks. When the guard checks a URL, it resolves the hostname once and records the IP. The outbound connection is then made directly to that IP using a pinned dispatcher (via undici), so the hostname cannot re-resolve to a different address between the check and the actual request.

## Audit log

When a user saves an Immich URL that resolves to a private IP, TREK records an `immich.private_ip_configured` entry in the [Audit-Log](Audit-Log) including the URL and the resolved IP address. This audit event is specific to Immich; Synology Photos does not emit an equivalent event.

## See also

- [Photo-Providers](Photo-Providers)
- [User-Settings](User-Settings)
- [Environment-Variables](Environment-Variables)
- [Security-Hardening](Security-Hardening)
