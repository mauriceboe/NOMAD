import { betterAuth } from 'better-auth';
import { typeormAdapter } from '@hedystia/better-auth-typeorm';
import { DataSource } from 'typeorm';
import { AuthConfig } from '../config/auth.config.js';

export function createAuth(dataSource: DataSource, cfg: AuthConfig) {
  return betterAuth({
    database: typeormAdapter(dataSource, { debugLogs: cfg.debugLogs }),
    secret: cfg.secret,
    baseURL: cfg.baseURL,
    basePath: '/api/auth',
    trustedOrigins: cfg.frontendUrl ? [cfg.frontendUrl] : [],
    advanced: {
      cookies: { session_token: { name: 'trek_session' } },
      useSecureCookies: cfg.cookieSecure,
    },
    emailAndPassword: { enabled: true },
    plugins: [],
  });
}
