'use client';
import { useState, useSyncExternalStore, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRightIcon, EyeIcon, EyeOffIcon, LoaderCircleIcon } from 'lucide-react';
import { authClient } from '@/infrastructure/auth/client';
import { fieldControl } from '@/components/ui/field';
const subscribe = () => () => {};
const label = 'grid gap-2 text-sm font-semibold';
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
  return <form className="my-8 grid gap-5" method="post" onSubmit={submit} aria-busy={busy}>
    <label className={label} htmlFor="email">Email<input id="email" name="email" type="email" autoComplete="username" required disabled={busy} className={`${fieldControl} h-12 text-base`}/></label>
    <div className="grid gap-2">
      <label className={label} htmlFor="password">Contraseña</label>
      <div className="relative"><input id="password" name="password" type={visible ? 'text' : 'password'} autoComplete="current-password" required minLength={12} maxLength={128} disabled={busy} className={`${fieldControl} h-12 pr-28 text-base`}/>
        <button type="button" aria-controls="password" aria-pressed={visible} onClick={() => setVisible(value => !value)} className="absolute top-1.5 right-1.5 flex h-9 cursor-pointer items-center gap-1.5 rounded-md px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">{visible ? <EyeOffIcon className="size-4"/> : <EyeIcon className="size-4"/>}{visible ? 'Ocultar' : 'Mostrar'}</button></div>
    </div>
    {error ? <p role="alert" className="rounded-xl border border-danger/30 bg-danger-surface p-3.5 text-sm text-foreground">{error}</p> : null}
    <button className="group mt-1 inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary text-[15px] font-semibold text-primary-foreground shadow-[0_12px_32px_-12px_rgb(255_206_19/0.8)] transition hover:brightness-105 active:translate-y-px disabled:cursor-wait disabled:opacity-60" type="submit" disabled={!hydrated || busy}>{busy ? <LoaderCircleIcon className="size-4 animate-spin"/> : null}{busy ? 'Ingresando…' : 'Ingresar'}{busy ? null : <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5"/>}</button>
  </form>;
}
