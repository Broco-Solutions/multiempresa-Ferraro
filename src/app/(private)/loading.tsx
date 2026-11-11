import { requireOwner } from '@/modules/identity/session';
import { layout } from '@/components/patterns/page';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default async function Loading() {
  await requireOwner();
  return <div className={layout.page}><section aria-busy="true" aria-label="Carga de información financiera" className="grid gap-6">
    <div className="grid gap-3"><Skeleton className="h-3 w-40"/><Skeleton className="h-9 w-72 max-w-full"/></div>
    <p role="status" className="text-xs text-muted-foreground">Cargando información financiera…</p>
    <div className={layout.grid3}>{[0, 1, 2].map(index => <Card key={index} className="grid gap-5 p-6"><Skeleton className="h-4 w-24"/><Skeleton className="h-8 w-44 max-w-full"/><Skeleton className="h-3 w-32"/></Card>)}</div>
    <Card className="p-6"><Skeleton className="h-72 w-full"/></Card>
  </section></div>;
}
