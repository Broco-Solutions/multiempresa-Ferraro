import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAuth, isOwnerAccount } from '@/infrastructure/auth/server';
export const getOwnerSession = cache(async () => {
  try {
    const current = await getAuth().api.getSession({ headers: await headers(), query: { disableCookieCache: true } });
    if (!current?.user.active || new Date(current.session.expiresAt).getTime() <= Date.now() || !await isOwnerAccount(current.user.id)) return null;
    return current;
  } catch { return null; }
});
export async function requireOwner() {
  const session = await getOwnerSession();
  if (!session) redirect('/login');
  return session;
}
