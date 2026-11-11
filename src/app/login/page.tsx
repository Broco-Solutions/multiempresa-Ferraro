import { redirect } from 'next/navigation';
import { LockKeyholeIcon, ShieldCheckIcon } from 'lucide-react';
import { getOwnerSession } from '@/modules/identity/session';
import { authEnvSchema } from '@/infrastructure/auth/config';
import { LoginForm } from '@/modules/identity/login-form';
import { CompanyLogo, FerraroLogo } from '@/components/brand/brand';
import { companies } from '@/config/companies';
export const dynamic = 'force-dynamic';
export default async function LoginPage() {
  if (await getOwnerSession()) redirect('/');
  const configured = authEnvSchema.safeParse(process.env).success;
  return <main className="grid min-h-svh bg-background lg:grid-cols-[1.1fr_1fr]">
    <section className="dark relative isolate flex flex-col justify-between gap-10 overflow-hidden bg-black p-6 text-white sm:p-10 lg:p-14">
      <div aria-hidden className="absolute inset-0 -z-10 cockpit-grid [--grid-line:rgb(255_255_255/0.05)] [mask-image:radial-gradient(80%_70%_at_30%_40%,black,transparent)]"/>
      <div aria-hidden className="absolute -top-40 -left-40 -z-10 size-[520px] rounded-full bg-brand-yellow/20 blur-[120px]"/>
      <div aria-hidden className="absolute right-[-120px] bottom-[-160px] -z-10 size-[420px] rounded-full bg-brand-gray/30 blur-[120px]"/>
      <div className="flex items-center gap-3"><span><FerraroLogo tone="white" className="w-[150px]"/><span className="mt-1.5 block text-[10px] font-bold tracking-[0.32em] text-white/60">MULTI-EMPRESA</span></span></div>
      <div className="hidden max-w-xl lg:block">
        <p className="flex items-center gap-2 text-[11px] font-bold tracking-[0.24em] text-brand-yellow"><span className="h-px w-8 bg-brand-yellow"/>UNA MIRADA COMPARTIDA</p>
        <h2 className="mt-6 text-[clamp(40px,4.6vw,68px)] leading-[1.02] font-bold tracking-[-0.045em]">Tus empresas.<br/><span className="bg-gradient-to-r from-brand-yellow via-[#ffe27a] to-white bg-clip-text text-transparent">Una visión clara.</span></h2>
        <p className="mt-6 max-w-md text-base text-white/65">Consulta financiera privada y de solo lectura, consolidada en USD con calendario argentino.</p>
        <ul className="mt-10 grid max-w-md gap-3">{companies.map((company, index) => <li key={company.id} className="flex animate-rise items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur" style={{ animationDelay: `${200 + index * 120}ms` }}><CompanyLogo id={company.id} size="md"/><span className="font-semibold">{company.name}</span><span className="ml-auto h-8 w-1 rounded-full" style={{ background: company.color }}/></li>)}</ul>
      </div>
      <small className="hidden text-xs text-white/45 lg:block">Ferraro Detail · PPF House · RFN Argentina</small>
    </section>
    <section className="relative grid place-items-center px-5 py-12 sm:px-10">
      <div aria-hidden className="pointer-events-none absolute inset-0 cockpit-glow opacity-60"/>
      <div className="relative w-full max-w-[420px] animate-rise">
        <span className="grid size-12 place-items-center rounded-2xl border border-primary/30 bg-primary/10 text-highlight"><LockKeyholeIcon className="size-5"/></span>
        <p className="mt-6 text-[11px] font-bold tracking-[0.2em] text-highlight">MULTI-EMPRESA FERRARO</p>
        <h1 className="mt-2 text-4xl font-bold tracking-[-0.04em]">Acceso privado</h1>
        <p className="mt-2 text-muted-foreground">Ingresá con tu cuenta de propietario.</p>
        {configured ? <LoginForm/> : <p role="alert" className="my-8 rounded-xl border border-danger/30 bg-danger-surface p-4 text-sm text-foreground">Acceso no disponible. Falta configurar la autenticación y su almacenamiento exclusivo. Las consultas financieras permanecen bloqueadas.</p>}
        <p className="flex gap-2 border-t pt-6 text-xs text-muted-foreground"><ShieldCheckIcon className="size-4 shrink-0 text-highlight"/>Acceso exclusivo del propietario. Si no podés ingresar, contactá al responsable técnico.</p>
      </div>
    </section>
  </main>;
}
