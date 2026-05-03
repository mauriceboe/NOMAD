import dns from 'node:dns/promises';
import { Agent } from 'undici';

const ALLOW_INTERNAL_NETWORK = process.env.ALLOW_INTERNAL_NETWORK?.toLowerCase() === 'true';

export interface SsrfResult {
  allowed: boolean;
  resolvedIp?: string;
  isPrivate: boolean;
  error?: string;
}

// Always blocked — no override possible
function isAlwaysBlocked(ip: string): boolean {
  // Strip IPv6 brackets
  const addr = ip.startsWith('[') ? ip.slice(1, -1) : ip;

  // Loopback
  if (addr.startsWith("127.") || addr === '::1') return true;
  // Unspecified
  if (addr.startsWith("0.")) return true;
  // Link-local / cloud metadata
  if (addr.startsWith("169.254.") || /^fe80:/i.test(addr)) return true;
  // IPv4-mapped loopback / link-local: ::ffff:127.x.x.x, ::ffff:169.254.x.x
  if (/^::ffff:127\./i.test(addr) || /^::ffff:169\.254\./i.test(addr)) return true;

  return false;
}

// Blocked unless ALLOW_INTERNAL_NETWORK=true
function isPrivateNetwork(ip: string): boolean {
  const addr = ip.startsWith('[') ? ip.slice(1, -1) : ip;

  // RFC-1918 private ranges
  if (addr.startsWith("10.")) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(addr)) return true;
  if (addr.startsWith("192.168.")) return true;
  // CGNAT / Tailscale shared address space (100.64.0.0/10)
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(addr)) return true;
  // IPv6 ULA (fc00::/7)
  if (/^f[cd]/i.test(addr)) return true;
  // IPv4-mapped RFC-1918
  if (/^::ffff:10\./i.test(addr)) return true;
  if (/^::ffff:172\.(1[6-9]|2\d|3[01])\./i.test(addr)) return true;
  if (/^::ffff:192\.168\./i.test(addr)) return true;

  return false;
}

function isInternalHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h.endsWith('.local') || h.endsWith('.internal') || h === 'localhost';
}

export async function checkSsrf(rawUrl: string, bypassInternalIpAllowed: boolean = false): Promise<SsrfResult> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { allowed: false, isPrivate: false, error: 'Invalid URL' };
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    return { allowed: false, isPrivate: false, error: 'Only HTTP and HTTPS URLs are allowed' };
  }

  const hostname = url.hostname.toLowerCase();

  // Resolve hostname to IP
  let resolvedIp: string;
  try {
    const result = await dns.lookup(hostname);
    resolvedIp = result.address;
  } catch {
    return { allowed: false, isPrivate: false, error: 'Could not resolve hostname' };
  }

  if (isAlwaysBlocked(resolvedIp)) {
    return {
      allowed: false,
      isPrivate: true,
      resolvedIp,
      error: 'Requests to loopback and link-local addresses are not allowed',
    };
  }

  if (isPrivateNetwork(resolvedIp) || isInternalHostname(hostname)) {
    if (!ALLOW_INTERNAL_NETWORK || bypassInternalIpAllowed) {
      return {
        allowed: false,
        isPrivate: true,
        resolvedIp,
        error: 'Requests to private/internal network addresses are not allowed. Set ALLOW_INTERNAL_NETWORK=true to permit this for self-hosted setups.',
      };
    }
    return { allowed: true, isPrivate: true, resolvedIp };
  }

  return { allowed: true, isPrivate: false, resolvedIp };
}

/**
 * Thrown by safeFetch() when the URL is blocked by the SSRF guard.
 */
export class SsrfBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SsrfBlockedError';
  }
}

export interface SafeFetchOptions {
  rejectUnauthorized?: boolean;
}

/**
 * SSRF-safe fetch wrapper. Validates the URL with checkSsrf(), then makes
 * the request using a DNS-pinned dispatcher so the resolved IP cannot change
 * between the check and the actual connection (DNS rebinding prevention).
 *
 * Pass `{ rejectUnauthorized: false }` for targets that use self-signed TLS
 * certificates (e.g. a Synology NAS on a local network). The SSRF guard still
 * applies — only the TLS certificate check is relaxed.
 */
export async function safeFetch(url: string, init?: RequestInit, options?: SafeFetchOptions): Promise<Response> {
  const ssrf = await checkSsrf(url);
  if (!ssrf.allowed) {
    throw new SsrfBlockedError(ssrf.error ?? 'Request blocked by SSRF guard');
  }
  const dispatcher = createPinnedDispatcher(ssrf.resolvedIp!, options?.rejectUnauthorized ?? true);
  return fetch(url, { ...init, dispatcher } as any);
}

/**
 * Returns an undici Agent whose connect.lookup is pinned to the already-validated
 * IP. This prevents DNS rebinding (TOCTOU) by ensuring the outbound connection
 * goes to the IP we checked, not a re-resolved one.
 */
export function createPinnedDispatcher(resolvedIp: string, rejectUnauthorized = true): Agent {
  return new Agent({
    connect: {
      rejectUnauthorized,
      lookup: (_hostname: string, opts: Record<string, unknown>, callback: Function) => {
        const family = resolvedIp.includes(':') ? 6 : 4;
        // Node.js 18+ may call lookup with `all: true`, expecting an array of address objects
        if (opts?.all) {
          callback(null, [{ address: resolvedIp, family }]);
        } else {
          callback(null, resolvedIp, family);
        }
      },
    },
  });
}
