import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAuth } from '@/infrastructure/auth/server';
export const getOwnerSession = cache(async () => {
  try {
    const current = await getAuth().api.getSession({ headers: await headers(), query: { disableCookieCache: true } });
    if (!current?.user.active || current.user.email !== process.env.AUTH_OWNER_EMAIL?.toLowerCase() || new Date(current.session.expiresAt).getTime() <= Date.now()) return null;
    return current;
  } catch { return null; }
});
export async function requireOwner() {
  const session = await getOwnerSession();
  if (!session) redirect('/login');
  return session;
}
