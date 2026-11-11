'use client';
import { Command as CommandPrimitive } from 'cmdk';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { SearchIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function CommandDialog({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode }) {
  return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0"/>
      <DialogPrimitive.Content className="fixed top-[18%] left-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
        <DialogPrimitive.Title className="sr-only">Buscar y navegar</DialogPrimitive.Title>
        <DialogPrimitive.Description className="sr-only">Saltá a una sección, empresa o período.</DialogPrimitive.Description>
        <CommandPrimitive className="flex flex-col [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:tracking-[0.14em] [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:uppercase">{children}</CommandPrimitive>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>;
}
export function CommandInput(props: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return <div className="flex items-center gap-3 border-b px-4"><SearchIcon className="size-4 text-muted-foreground"/><CommandPrimitive.Input className="h-14 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" {...props}/></div>;
}
export function CommandList({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
  return <CommandPrimitive.List className={cn('max-h-[360px] overflow-y-auto p-2', className)} {...props}/>;
}
export const CommandEmpty = (props: React.ComponentProps<typeof CommandPrimitive.Empty>) => <CommandPrimitive.Empty className="py-10 text-center text-sm text-muted-foreground" {...props}/>;
export const CommandGroup = CommandPrimitive.Group;
export function CommandItem({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return <CommandPrimitive.Item className={cn('flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground [&_svg]:size-4 [&_svg]:text-muted-foreground', className)} {...props}/>;
}
