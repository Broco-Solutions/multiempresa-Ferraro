import { beforeEach, describe, expect, it, vi } from 'vitest';
import { rootCertificates } from 'node:tls';
vi.mock('server-only', () => ({}));
const { getAuth, isOwnerAccount, redirect } = vi.hoisted(() => ({ getAuth: vi.fn(), isOwnerAccount: vi.fn(), redirect: vi.fn(() => { throw new Error('REDIRECT_LOGIN'); }) }));
vi.mock('../../src/infrastructure/auth/server', () => ({ getAuth, isOwnerAccount }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('next/navigation', () => ({ redirect }));
import { GET, POST } from '../../src/app/api/auth/[...all]/route';
import { getOwnerSession, requireOwner } from '../../src/modules/identity/session';
import { authEnvSchema, bootstrapOwnerEnvSchema } from '../../src/infrastructure/auth/config';
beforeEach(() => { getAuth.mockReset(); isOwnerAccount.mockReset(); redirect.mockClear(); });
describe('closed authorization boundary', () => {
  it('fails closed without configuration or when the session store fails', async () => {
    expect(authEnvSchema.safeParse({}).success).toBe(false);
    getAuth.mockImplementation(() => { throw new Error('private database credentials must never escape'); });
    expect(await getOwnerSession()).toBeNull();
    await expect(requireOwner()).rejects.toThrow('REDIRECT_LOGIN');
    expect(redirect).toHaveBeenCalledWith('/login');
    const response = await POST(new Request('https://app.example.com/api/auth/sign-in/email', { method: 'POST' }));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('credentials');
  });
  it('does not publish registration, password or user administration endpoints', async () => {
    for (const path of ['sign-up/email', 'reset-password', 'change-password', 'update-user', 'delete-user']) {
      expect((await POST(new Request(`https://app.example.com/api/auth/${path}`, { method: 'POST' }))).status).toBe(404);
    }
    expect(getAuth).not.toHaveBeenCalled();
  });
  it('hides internal storage diagnostics and rejects inactive sessions', async () => {
    getAuth.mockReturnValue({ handler: async () => Response.json({ message: 'private SQL trace' }, { status: 500 }) });
    const response = await POST(new Request('https://app.example.com/api/auth/sign-out', { method: 'POST' }));
    expect(await response.text()).not.toContain('SQL');
    getAuth.mockReturnValue({ handler: async () => Response.json({ user: { id: 'owner-id', active: false } }) });
    expect(await (await GET(new Request('https://app.example.com/api/auth/get-session'))).json()).toBeNull();
  });
  it('does not require an owner email environment variable and checks persisted ownership', async () => {
    // Public CA from Node's trust store; no production certificate or credentials.
    const applicationConfig = { BETTER_AUTH_URL: 'https://app.example.test', BETTER_AUTH_SECRET: 'x'.repeat(32), AUTH_DATABASE_URL: 'postgresql://u:p@localhost/db', AUTH_DATABASE_CA: rootCertificates[0]! };
    expect(authEnvSchema.safeParse(applicationConfig).success).toBe(true);
    expect(authEnvSchema.safeParse({ ...applicationConfig, AUTH_DATABASE_CA: undefined }).success).toBe(false);
    expect(authEnvSchema.safeParse({ ...applicationConfig, AUTH_DATABASE_CA: 'invalid-certificate' }).success).toBe(false);
    expect(bootstrapOwnerEnvSchema.safeParse({ ...applicationConfig, BOOTSTRAP_OWNER_EMAIL: ' Owner@Example.test ', BOOTSTRAP_OWNER_NAME: ' Propietario ', BOOTSTRAP_OWNER_PASSWORD: 'isolated-owner-password' }).data?.BOOTSTRAP_OWNER_EMAIL).toBe('owner@example.test');
    expect(bootstrapOwnerEnvSchema.safeParse({ ...applicationConfig, BOOTSTRAP_OWNER_EMAIL: 'invalid', BOOTSTRAP_OWNER_NAME: 'Propietario', BOOTSTRAP_OWNER_PASSWORD: 'isolated-owner-password' }).success).toBe(false);
    getAuth.mockReturnValue({ api: { getSession: async () => ({ user: { id: 'persisted-id', active: true }, session: { expiresAt: new Date(Date.now() + 60000) } }) } });
    isOwnerAccount.mockResolvedValue(false);
    expect(await getOwnerSession()).toBeNull();
    isOwnerAccount.mockResolvedValue(true);
    expect((await getOwnerSession())?.user.id).toBe('persisted-id');
  });
});
