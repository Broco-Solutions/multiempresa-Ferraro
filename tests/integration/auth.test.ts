import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAuth } from '../../src/infrastructure/auth/config';
import { hashPassword } from '../../src/infrastructure/auth/password';
import { ownerEmail, ownerPassword, testPool, testSecret } from '../fixtures/auth';

// No silent fallback to a production DB. See README for the isolated Docker command.
describe.skipIf(!process.env.AUTH_TEST_DATABASE_URL)('persistent owner authentication (PostgreSQL)', () => {
  const pool = process.env.AUTH_TEST_DATABASE_URL ? testPool() : undefined!;
  const config = { AUTH_DATABASE_URL: process.env.AUTH_TEST_DATABASE_URL!, AUTH_OWNER_EMAIL: ownerEmail, BETTER_AUTH_URL: 'http://localhost:4317', BETTER_AUTH_SECRET: testSecret };
  let auth: ReturnType<typeof createAuth>;
  const id = randomUUID();
  function request(path: string, body?: unknown, cookie?: string, origin = config.BETTER_AUTH_URL) {
    return new Request(config.BETTER_AUTH_URL + '/api/auth' + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', Origin: origin, ...(cookie ? { Cookie: cookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  }
  async function login(instance = auth, password = ownerPassword, email = ownerEmail) { return instance.handler(request('/sign-in/email', { email, password })); }
  async function cookie() {
    const response = await login(); expect(response.status).toBe(200);
    return response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  }
  beforeAll(async () => {
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    await pool.query(await readFile(new URL('../../docs/auth-schema.sql', import.meta.url), 'utf8'));
    await pool.query('INSERT INTO "user" (id,name,email,"emailVerified",active) VALUES ($1,$2,$3,true,true)', [id, 'Test Owner', ownerEmail]);
    await pool.query('INSERT INTO account (id,"accountId","providerId","userId",password,"updatedAt") VALUES ($1,$2::text,$3,$2::uuid,$4,NOW())', [randomUUID(), id, 'credential', await hashPassword(ownerPassword)]);
    auth = createAuth(pool, config);
  });
  beforeEach(async () => { await pool.query('TRUNCATE "session", "rateLimit"'); await pool.query('UPDATE "user" SET active=true'); });
  afterAll(async () => { if (pool) await pool.end(); });
  it('stores Argon2id and issues HttpOnly SameSite cookies with an absolute 12h lifetime', async () => {
    const response = await login(); expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toMatch(/HttpOnly/i);
    expect(response.headers.get('set-cookie')).toMatch(/SameSite=Lax/i);
    const { rows } = await pool.query('SELECT "expiresAt", "createdAt" FROM "session"');
    expect(rows[0].expiresAt.getTime() - rows[0].createdAt.getTime()).toBeLessThanOrEqual(12 * 3600000 + 1000);
    const account = await pool.query('SELECT password FROM account');
    expect(account.rows[0].password).toMatch(/^\$argon2id\$/);
    expect(account.rows[0].password).not.toContain(ownerPassword);
  });
  it('uses Secure cookies over HTTPS in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const production = createAuth(pool, { ...config, BETTER_AUTH_URL: 'https://owner.example.test' });
    vi.unstubAllEnvs();
    const response = await production.handler(new Request('https://owner.example.test/api/auth/sign-in/email', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://owner.example.test' }, body: JSON.stringify({ email: ownerEmail, password: ownerPassword }) }));
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toMatch(/__Secure-better-auth.session_token/);
    expect(response.headers.get('set-cookie')).toMatch(/; Secure/i);
    expect(response.headers.get('set-cookie')).toMatch(/; HttpOnly/i);
  });
  it('rejects invalid credentials generically, rejects signup and foreign origins', async () => {
    const invalid = await login(auth, 'wrong-password-123');
    const absent = await login(auth, ownerPassword, 'absent@example.test');
    expect(invalid.status).toBe(401); expect(absent.status).toBe(401);
    expect((await invalid.json()).message).toBe((await absent.json()).message);
    expect((await auth.handler(request('/sign-up/email', { name: 'Other', email: 'other@example.test', password: ownerPassword }))).status).not.toBe(200);
    expect((await auth.handler(request('/sign-in/email', { email: ownerEmail, password: ownerPassword }, undefined, 'https://attacker.example'))).status).toBe(403);
  });
  it('persists 5/60s throttling across instances and concurrent attempts', async () => {
    const second = createAuth(pool, config);
    const responses = await Promise.all(Array.from({ length: 9 }, (_, index) => login(index % 2 ? auth : second, 'incorrect-password')));
    expect(responses.filter(response => response.status === 401)).toHaveLength(5);
    expect(responses.filter(response => response.status === 429)).toHaveLength(4);
    expect((await pool.query('SELECT count FROM "rateLimit"')).rows[0].count).toBe(5);
    await pool.query('UPDATE "rateLimit" SET "lastRequest" = $1', [Date.now() - 61000]);
    expect((await login(second)).status).toBe(200);
  });
  it('revokes on logout and rejects expired sessions', async () => {
    const token = await cookie();
    expect((await (await auth.handler(request('/get-session', undefined, token))).json()).user.email).toBe(ownerEmail);
    expect((await auth.handler(request('/sign-out', {}, token))).status).toBe(200);
    expect(await (await auth.handler(request('/get-session', undefined, token))).json()).toBeNull();
    const expired = await cookie(); await pool.query('UPDATE "session" SET "expiresAt" = NOW() - interval \'1 second\'');
    expect(await (await auth.handler(request('/get-session', undefined, expired))).json()).toBeNull();
  });
  it('refuses disabled users and additional owners at database level', async () => {
    await pool.query('UPDATE "user" SET active=false');
    expect((await login()).status).toBe(401);
    await expect(pool.query('INSERT INTO "user" (id,name,email,"emailVerified",active) VALUES ($1,$2,$3,true,true)', [randomUUID(), 'Other', 'other@example.test'])).rejects.toThrow();
  });
});
