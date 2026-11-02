import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const { getAuth, redirect } = vi.hoisted(() => ({ getAuth: vi.fn(), redirect: vi.fn(() => { throw new Error('REDIRECT_LOGIN'); }) }));
vi.mock('../../src/infrastructure/auth/server', () => ({ getAuth }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('next/navigation', () => ({ redirect }));
import { GET, POST } from '../../src/app/api/auth/[...all]/route';
import { getOwnerSession, requireOwner } from '../../src/modules/identity/session';
import { authEnvSchema } from '../../src/infrastructure/auth/config';
beforeEach(() => { getAuth.mockReset(); redirect.mockClear(); });
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
    getAuth.mockReturnValue({ handler: async () => Response.json({ user: { email: 'other@example.test', active: false } }) });
    expect(await (await GET(new Request('https://app.example.com/api/auth/get-session'))).json()).toBeNull();
  });
});
