import { betterAuth } from 'better-auth';
import { typeormAdapter } from '@hedystia/better-auth-typeorm';
import { magicLink } from 'better-auth/plugins/magic-link';
import { genericOAuth } from 'better-auth/plugins/generic-oauth';
import { jwt } from 'better-auth/plugins/jwt';
import { oauthProvider } from '@better-auth/oauth-provider';
import { passkey } from '@better-auth/passkey';
import { DataSource } from 'typeorm';

// Used only by `npx @better-auth/cli generate`.
// Not imported at runtime — auth.factory.ts uses the DI DataSource.
const dataSource = new DataSource({
  type: 'better-sqlite3',
  database: ':memory:',
});

export const auth = betterAuth({
  baseURL: 'http://localhost:3000',
  database: typeormAdapter(dataSource, {
    entitiesDir: './src/models/entities/auth',
    migrationsDir: './src/database/migrations',
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendVerificationEmail: async () => {},
    sendResetPassword: async () => {},
  },
  emailVerification: {
    sendVerificationEmail: async () => {},
  },
  plugins: [
    jwt(),
    magicLink({ sendMagicLink: async () => {} }),
    genericOAuth({ config: [] }),
    oauthProvider({ loginPage: '/login' }),
    passkey(),
  ],
});
