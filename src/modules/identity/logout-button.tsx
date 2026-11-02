'use client';
import { useState } from 'react';
import { authClient } from '@/infrastructure/auth/client';
export function LogoutButton() {
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
  return <div><button type="button" onClick={logout} disabled={busy}>{busy ? 'Cerrando sesión…' : 'Cerrar sesión'}</button>{error ? <p role="alert">No se pudo cerrar la sesión. Reintentá.</p> : null}</div>;
}
