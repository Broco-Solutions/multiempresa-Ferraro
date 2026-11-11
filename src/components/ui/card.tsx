import { cn } from '@/lib/utils';

export function Card({ className, as: Tag = 'div', ...props }: React.ComponentProps<'div'> & { as?: 'div' | 'article' | 'section' }) {
  return <Tag data-slot="card" className={cn('card-sheen min-w-0 rounded-2xl border bg-card text-card-foreground shadow-[0_1px_2px_rgb(0_0_0/0.04)] dark:shadow-[0_24px_48px_-24px_rgb(0_0_0/0.8)]', className)} {...props}/>;
}
export function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-header" className={cn('flex flex-wrap items-start justify-between gap-3 p-5 pb-0 sm:p-6 sm:pb-0', className)} {...props}/>;
}
export function CardTitle({ className, ...props }: React.ComponentProps<'h2'>) {
  return <h2 data-slot="card-title" className={cn('text-base font-semibold tracking-tight', className)} {...props}/>;
}
export function CardDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p data-slot="card-description" className={cn('mt-1 text-xs leading-relaxed text-muted-foreground', className)} {...props}/>;
}
export function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn('p-5 sm:p-6', className)} {...props}/>;
}
