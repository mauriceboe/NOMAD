import { registerAs } from '@nestjs/config';
import { boolean } from 'better-auth';

export interface AuthConfig {
  secret: string;
  baseURL: string;
  frontendUrl: string | undefined;
  cookieSecure: boolean;
  debugLogs: boolean;
}

export default registerAs(
  'auth',
  (): AuthConfig => ({
    secret: process.env.BETTER_AUTH_SECRET ?? 'changeme',
    baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
    frontendUrl: process.env.BASE_URL,
    cookieSecure:
      process.env.COOKIE_SECURE === 'true' &&
      process.env.NODE_ENV === 'production' &&
      process.env.BASE_URL?.startsWith('https') === true,
    debugLogs:
      process.env.BETTER_AUTH_DEBUG_LOGS === 'true' ||
      process.env.NODE_ENV === 'development',
  }),
);
