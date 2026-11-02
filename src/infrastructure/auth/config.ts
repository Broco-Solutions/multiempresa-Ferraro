import { APIError, betterAuth } from 'better-auth';
import type { Pool } from 'pg';
import { z } from 'zod';
import { hashPassword, verifyPassword } from './password';

export const authEnvSchema = z.object({
  BETTER_AUTH_URL: z.url().refine(value => {
    const url = new URL(value);
    return !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash &&
      (url.protocol === 'https:' || (process.env.NODE_ENV !== 'production' && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)));
  }),
  BETTER_AUTH_SECRET: z.string().min(32),
  AUTH_DATABASE_URL: z.url().refine(value => ['postgres:', 'postgresql:'].includes(new URL(value).protocol)),
  AUTH_OWNER_EMAIL: z.email().transform(value => value.toLowerCase()),
});
export type AuthConfig = z.infer<typeof authEnvSchema>;

export function createAuth(database: Pool, config: AuthConfig) {
  return betterAuth({
    appName: 'Multi-Empresa Ferraro',
    baseURL: config.BETTER_AUTH_URL,
    secret: config.BETTER_AUTH_SECRET,
    trustedOrigins: [new URL(config.BETTER_AUTH_URL).origin],
    database,
    logger: { disabled: true },
    // Let our route boundary sanitize failures; better-call otherwise logs raw storage exceptions.
    onAPIError: { throw: true },
    emailAndPassword: {
      enabled: true, disableSignUp: true, minPasswordLength: 12, maxPasswordLength: 128,
      password: { hash: hashPassword, verify: ({ hash, password }) => verifyPassword(password, hash) },
    },
    session: { expiresIn: 60 * 60 * 12, disableSessionRefresh: true, cookieCache: { enabled: false } },
    user: { additionalFields: { active: { type: 'boolean', required: true, defaultValue: true, input: false } } },
    advanced: {
      disableOriginCheck: false,
      disableCSRFCheck: false,
      database: { generateId: 'uuid' },
      useSecureCookies: process.env.NODE_ENV === 'production',
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', path: '/' },
      // One owner: a shared persistent bucket prevents spoofed IP headers from bypassing the limit.
      ipAddress: { ipAddressHeaders: [] },
    },
    rateLimit: { enabled: true, storage: 'database', customRules: { '/sign-in/email': { window: 60, max: 5 } } },
    databaseHooks: { session: { create: { before: async session => {
      const result = await database.query('SELECT email, active FROM "user" WHERE id = $1', [session.userId]);
      const owner = result.rows[0];
      if (!owner?.active || owner.email !== config.AUTH_OWNER_EMAIL) {
        throw new APIError('UNAUTHORIZED', { message: 'No fue posible iniciar sesión.' });
      }
      return { data: session };
    } } } },
  });
}
