import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const badgeVariants = cva('inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none [&>svg]:size-3.5', {
  variants: {
    variant: {
      neutral: 'border-border bg-muted text-muted-foreground',
      success: 'border-transparent bg-success-surface text-success',
      warning: 'border-transparent bg-warning-surface text-warning',
      danger: 'border-transparent bg-danger-surface text-danger',
      info: 'border-transparent bg-info-surface text-info',
      brand: 'border-primary/30 bg-primary/10 text-highlight',
    },
  },
  defaultVariants: { variant: 'neutral' },
});

export function Badge({ className, variant, ...props }: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props}/>;
}
