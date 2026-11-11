import { cn } from '@/lib/utils';

/** Controles nativos estilizados: preservan el comportamiento de formularios GET y la accesibilidad del navegador. */
export const fieldLabel = 'grid min-w-0 gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground';
export const fieldControl = 'h-10 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-sm font-medium normal-case tracking-normal text-foreground shadow-[inset_0_1px_2px_rgb(0_0_0/0.06)] transition-colors outline-none hover:border-foreground/25 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 focus-visible:outline-none';

export function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return <input data-slot="input" className={cn(fieldControl, className)} {...props}/>;
}
export function NativeSelect({ className, ...props }: React.ComponentProps<'select'>) {
  return <select data-slot="select" className={cn(fieldControl, 'cursor-pointer appearance-none bg-[url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2216%22%20height%3D%2216%22%20fill%3D%22none%22%20stroke%3D%22%23888%22%20stroke-width%3D%222%22%20viewBox%3D%220%200%2024%2024%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22/%3E%3C/svg%3E")] bg-[length:16px] bg-[right_10px_center] bg-no-repeat pr-9', className)} {...props}/>;
}
