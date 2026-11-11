'use client';
import { useState } from 'react';
import { LogOutIcon } from 'lucide-react';
import { authClient } from '@/infrastructure/auth/client';
export function LogoutButton({ compact = false }: { compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function logout() {
    setBusy(true); setError(false);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error('LOGOUT_FAILED');
      // Full navigation discards the private Router Cache.
      window.location.replace('/login');
    } catch { setError(true); setBusy(false); }
  }
  if (compact) return <div className="relative"><button type="button" onClick={logout} disabled={busy} className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border bg-card/60 px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"><LogOutIcon aria-hidden className="size-4"/><span className="sr-only">{busy ? 'Cerrando sesión…' : 'Cerrar sesión'}</span></button>{error ? <p role="alert" className="absolute top-11 right-0 w-56 rounded-lg border bg-popover p-2 text-xs text-danger shadow-xl">No se pudo cerrar la sesión. Reintentá.</p> : null}</div>;
  return <div className="mt-3"><button type="button" onClick={logout} disabled={busy} className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/12 px-3 py-2 text-xs font-semibold text-sidebar-foreground transition-colors hover:border-brand-yellow/60 hover:bg-brand-yellow/10 disabled:opacity-60"><LogOutIcon aria-hidden className="size-3.5"/>{busy ? 'Cerrando sesión…' : 'Cerrar sesión'}</button>{error ? <p role="alert" className="mt-2 text-xs text-danger">No se pudo cerrar la sesión. Reintentá.</p> : null}</div>;
}
