import { cn } from '@/lib/utils';

export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="skeleton" aria-hidden className={cn('skeleton-shimmer animate-shimmer rounded-lg', className)} {...props}/>;
}
