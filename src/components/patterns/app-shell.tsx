import Link from 'next/link';
import { EyeIcon } from 'lucide-react';
import { LogoutButton } from '@/modules/identity/logout-button';
import { companies } from '@/config/companies';
import { CompanyLogo, FerraroLogo } from '@/components/brand/brand';
import { CommandMenu, MobileNav, NavLinks, ThemeToggle } from './shell-client';

function SidebarFooter() {
  return <div className="m-3 rounded-xl border border-sidebar-border bg-white/[0.03] p-4 text-xs text-sidebar-foreground">
    <p className="text-[10px] font-bold tracking-[0.18em] text-sidebar-muted">FUENTES</p>
    <ul className="mt-3 grid gap-2.5">{companies.map(company => <li key={company.id} className="flex items-center gap-2.5"><CompanyLogo id={company.id} size="xs"/><span className="truncate">{company.name}</span></li>)}</ul>
    <p className="mt-4 flex items-center gap-2 border-t border-sidebar-border pt-3 text-sidebar-muted"><EyeIcon aria-hidden className="size-3.5"/>Consulta financiera · Solo lectura</p>
    <LogoutButton/>
  </div>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-svh">
    <a href="#contenido" className="sr-only z-[60] rounded-md bg-primary px-3 py-2 font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3">Saltar al contenido</a>
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 cockpit-glow opacity-70"/>
      <Link href="/" className="relative flex items-center gap-3 px-6 pt-8 pb-10">
        <span><FerraroLogo tone="white" className="w-[132px]"/><span className="mt-1.5 block text-[9px] font-bold tracking-[0.32em] text-sidebar-muted">MULTI-EMPRESA</span></span>
      </Link>
      <p className="px-6 pb-2 text-[10px] font-bold tracking-[0.18em] text-sidebar-muted">GENERAL</p>
      <div className="relative px-3"><NavLinks/></div>
      <div className="mt-auto"><SidebarFooter/></div>
    </aside>
    <div className="lg:pl-64">
      <header className="glass sticky top-0 z-30 flex h-16 items-center gap-3 border-b px-4 sm:px-6 lg:px-10">
        <MobileNav footer={<SidebarFooter/>}/>
        <Link href="/" className="flex items-center gap-2 lg:hidden"><FerraroLogo className="w-[92px]"/></Link>
        <div className="ml-auto flex items-center gap-2"><span className="hidden items-center gap-2 rounded-lg border bg-card/60 px-3 py-2 text-[11px] font-semibold text-muted-foreground md:flex"><span className="size-1.5 rounded-full bg-success animate-pulse-dot text-success"/>USD · Buenos Aires</span><CommandMenu/><ThemeToggle/><div className="lg:hidden"><LogoutButton compact/></div></div>
      </header>
      <main id="contenido" className="relative min-w-0 px-4 pt-8 pb-20 sm:px-6 lg:px-10 lg:pt-10">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] cockpit-grid [mask-image:linear-gradient(to_bottom,black,transparent)]"/>
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[360px] cockpit-glow"/>
        {children}
      </main>
    </div>
  </div>;
}
