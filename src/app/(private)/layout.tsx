import { AppShell } from '@/components/patterns/app-shell';
import { requireOwner } from '@/modules/identity/session';
export const dynamic = 'force-dynamic';
export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  await requireOwner();
  return <AppShell>{children}</AppShell>;
}
