'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { useTheme } from 'next-themes';
import { CalendarRangeIcon, CommandIcon, MenuIcon, MoonIcon, SearchIcon, SunIcon } from 'lucide-react';
import { companies } from '@/config/companies';
import { executivePresets } from '@/modules/finance/executive-periods';
import { CompanyLogo, FerraroLogo } from '@/components/brand/brand';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { isActive, navLinks } from './nav-config';

export function NavLinks({ onNavigate, layoutId = 'nav-active' }: { onNavigate?: () => void; layoutId?: string }) {
  const pathname = usePathname();
  return <nav aria-label="Navegación principal" className="grid gap-1">
    {navLinks.map(({ href, label, Icon }) => {
      const active = isActive(pathname, href);
      return <Link key={href} href={href} onClick={onNavigate} aria-current={active ? 'page' : undefined}
        className={cn('group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-foreground', active && 'text-sidebar-foreground')}>
        {active ? <motion.span layoutId={layoutId} transition={{ type: 'spring', stiffness: 420, damping: 34 }} className="absolute inset-0 rounded-lg bg-white/[0.07] ring-1 ring-white/[0.08]">
          <span className="absolute top-2 bottom-2 -left-3 w-[3px] rounded-r-full bg-brand-yellow shadow-[0_0_14px_2px_rgb(255_206_19/0.55)]"/>
        </motion.span> : null}
        <Icon aria-hidden className={cn('relative size-[18px] transition-colors', active ? 'text-brand-yellow' : 'group-hover:text-sidebar-foreground')}/>
        <span className="relative">{label}</span>
      </Link>;
    })}
  </nav>;
}

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  return <button type="button" onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
    className={cn('grid size-9 cursor-pointer place-items-center rounded-lg border bg-card/60 text-muted-foreground transition-colors hover:text-foreground', className)}>
    <SunIcon aria-hidden className="hidden size-4 dark:block"/><MoonIcon aria-hidden className="size-4 dark:hidden"/>
    <span className="sr-only">Cambiar tema claro u oscuro</span>
  </button>;
}

export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setOpen(value => !value); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const go = (href: string) => { setOpen(false); router.push(href); };
  return <>
    <button type="button" onClick={() => setOpen(true)} className="group flex h-9 min-w-0 cursor-pointer items-center gap-2.5 rounded-lg border bg-card/60 px-3 text-xs whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground sm:w-72">
      <SearchIcon aria-hidden className="size-4"/><span className="hidden truncate sm:inline">Buscar sección o empresa…</span><span className="sr-only sm:hidden">Buscar</span>
      <kbd className="ml-auto hidden items-center gap-0.5 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] sm:inline-flex"><CommandIcon aria-hidden className="size-2.5"/>K</kbd>
    </button>
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="¿A dónde vamos?"/>
      <CommandList>
        <CommandEmpty>Sin resultados.</CommandEmpty>
        <CommandGroup heading="Secciones">{navLinks.map(({ href, label, hint, Icon }) => <CommandItem key={href} value={`${label} ${hint}`} onSelect={() => go(href)}><Icon/>{label}<span className="ml-auto text-xs text-muted-foreground">{hint}</span></CommandItem>)}</CommandGroup>
        <CommandGroup heading="Empresas">{companies.map(company => <CommandItem key={company.id} value={company.name} onSelect={() => go(`/empresas/${company.id}`)}><CompanyLogo id={company.id} size="xs"/>{company.name}</CommandItem>)}</CommandGroup>
        <CommandGroup heading="Período del inicio">{(open ? executivePresets(new Date()) : []).map(preset => <CommandItem key={preset.id} value={`Período ${preset.label}`} onSelect={() => go(`/?${new URLSearchParams(preset.period)}`)}><CalendarRangeIcon/>{preset.label}<span className="ml-auto num text-xs text-muted-foreground">{preset.period.desde} → {preset.period.hasta}</span></CommandItem>)}</CommandGroup>
        <CommandGroup heading="Preferencias"><CommandItem value="tema claro oscuro" onSelect={() => { setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'); setOpen(false); }}><SunIcon/>Cambiar tema claro / oscuro</CommandItem></CommandGroup>
      </CommandList>
    </CommandDialog>
  </>;
}

export function MobileNav({ footer }: { footer: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return <Sheet open={open} onOpenChange={setOpen}>
    <SheetTrigger className="grid size-9 cursor-pointer place-items-center rounded-lg border bg-card/60 lg:hidden"><MenuIcon aria-hidden className="size-4"/><span className="sr-only">Abrir menú</span></SheetTrigger>
    <SheetContent>
      <SheetTitle className="sr-only">Menú</SheetTitle><SheetDescription className="sr-only">Secciones de Multi-Empresa Ferraro</SheetDescription>
      <div className="px-6 pt-7 pb-8"><FerraroLogo tone="white" className="w-[118px]"/><p className="mt-2.5 text-[10px] font-bold tracking-[0.28em] text-sidebar-muted">MULTI-EMPRESA</p></div>
      <div className="px-3"><NavLinks onNavigate={() => setOpen(false)} layoutId="nav-active-mobile"/></div>
      <div className="mt-auto">{footer}</div>
    </SheetContent>
  </Sheet>;
}
