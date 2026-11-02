'use client';
import { useState, useSyncExternalStore, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/infrastructure/auth/client';
import styles from '@/app/login/login.module.css';
const subscribe = () => () => {};
export function LoginForm() {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setError('');
    try {
      const result = await authClient.signIn.email({ email: String(form.get('email')).trim(), password: String(form.get('password')), rememberMe: false });
      if (result.error) {
        setError(result.error.status === 429 ? 'Demasiados intentos. Esperá un minuto y volvé a intentar.' : result.error.status >= 500 ? 'Acceso no disponible. Revisá la configuración de autenticación y su almacenamiento.' : 'No pudimos ingresar. Revisá tus credenciales e intentá nuevamente.');
      } else { router.replace('/'); router.refresh(); }
    } catch { setError('Acceso temporalmente no disponible. Intentá nuevamente.'); }
    finally { setBusy(false); }
  }
  return <form className={styles.form} method="post" onSubmit={submit} aria-busy={busy}>
    <label htmlFor="email">Email<input id="email" name="email" type="email" autoComplete="username" required disabled={busy}/></label>
    <label htmlFor="password">Contraseña</label>
    <div className={styles.password}><input id="password" name="password" type={visible ? 'text' : 'password'} autoComplete="current-password" required minLength={12} maxLength={128} disabled={busy}/><button type="button" aria-controls="password" aria-pressed={visible} onClick={() => setVisible(value => !value)}>{visible ? 'Ocultar' : 'Mostrar'}</button></div>
    {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    <button className={styles.submit} type="submit" disabled={!hydrated || busy}>{busy ? 'Ingresando…' : 'Ingresar'}</button>
  </form>;
}
