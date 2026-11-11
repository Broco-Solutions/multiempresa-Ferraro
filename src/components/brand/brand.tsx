import Image from 'next/image';
import { companies, companyById } from '@/config/companies';
import { cn } from '@/lib/utils';

/** Logotipo oficial Ferraro. Nunca se reconstruye con texto ni se recolorea. */
export function FerraroLogo({ tone = 'auto', className }: { tone?: 'auto' | 'white' | 'black'; className?: string }) {
  if (tone !== 'auto') return <Image src={`/brand/ferraro-logo-${tone}.svg`} alt="Ferraro" width={270} height={75} unoptimized loading="eager" className={cn('h-auto w-[120px]', className)}/>;
  return <span className={cn('inline-flex', className)}>
    <Image src="/brand/ferraro-logo-black.svg" alt="Ferraro" width={270} height={75} unoptimized className="h-auto w-full dark:hidden"/>
    <Image src="/brand/ferraro-logo-white.svg" alt="" aria-hidden width={270} height={75} unoptimized className="hidden h-auto w-full dark:block"/>
  </span>;
}

export function FerraroLockup({ className }: { className?: string }) {
  return <Image src="/brand/ferraro-lockup-detail-tricolor.svg" alt="Ferraro Detail" width={270} height={75} unoptimized className={cn('h-auto w-[180px]', className)}/>;
}

/** Isotipo tricolor: tres módulos negro · gris · amarillo. */
export function FerraroMark({ className }: { className?: string }) {
  return <Image src="/brand/ferraro-mark-tricolor.svg" alt="" aria-hidden width={19} height={57} unoptimized className={cn('h-8 w-auto', className)}/>;
}

const tileSizes = { xs: 'size-6 rounded-md p-1', sm: 'size-8 rounded-lg p-1.5', md: 'size-11 rounded-xl p-2', lg: 'size-16 rounded-2xl p-3' } as const;

/** Logo oficial de cada empresa sobre una placa clara neutra, legible en ambos temas. */
export function CompanyLogo({ id, size = 'md', className }: { id: string; size?: keyof typeof tileSizes; className?: string }) {
  const company = companyById(id);
  if (!company) return null;
  return <span className={cn('relative flex shrink-0 items-center justify-center overflow-hidden bg-white ring-1 ring-black/5 shadow-[0_1px_0_rgb(255_255_255/0.6)_inset,0_6px_16px_-8px_rgb(0_0_0/0.5)]', tileSizes[size], className)}>
    <Image src={company.logo.src} alt="" width={company.logo.width} height={company.logo.height} unoptimized className="h-auto max-h-full w-auto max-w-full min-w-0 object-contain"/>
  </span>;
}

export function CompanyDot({ id, className }: { id: string; className?: string }) {
  const company = companyById(id);
  return <span aria-hidden className={cn('inline-block size-2 shrink-0 rounded-full', className)} style={{ background: company?.color }}/>;
}

export function CompanyLogoRow({ className }: { className?: string }) {
  return <span className={cn('flex items-center -space-x-1.5', className)}>{companies.map(company => <CompanyLogo key={company.id} id={company.id} size="sm" className="ring-2 ring-background"/>)}</span>;
}
