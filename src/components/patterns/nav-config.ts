import { ArrowLeftRightIcon, Building2Icon, LayoutDashboardIcon, TrendingDownIcon, TrendingUpIcon } from 'lucide-react';

export const navLinks = [
  { href: '/', label: 'Inicio', hint: 'Resumen ejecutivo', Icon: LayoutDashboardIcon },
  { href: '/ingresos', label: 'Ingresos', hint: 'Cobros por empresa', Icon: TrendingUpIcon },
  { href: '/gastos', label: 'Gastos', hint: 'Compras, sueldos y egresos', Icon: TrendingDownIcon },
  { href: '/movimientos', label: 'Movimientos', hint: 'Entradas y salidas individuales', Icon: ArrowLeftRightIcon },
  { href: '/empresas', label: 'Empresas', hint: 'Estado de las fuentes', Icon: Building2Icon },
] as const;

export function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');
}
