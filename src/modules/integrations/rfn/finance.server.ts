import 'server-only';
import { requireOwner } from '@/modules/identity/session';
import { getRfnIdentity, getRfnSummary, getRfnExpenses, RfnIntegrationError, type RfnDateRange, type RfnExpensesOptions } from './client.server';
export function integrationMessage(error: unknown): string {
  if (!(error instanceof RfnIntegrationError)) return 'RFN Argentina no disponible. No se muestran importes.';
  const messages = {
    NOT_CONFIGURED: 'RFN Argentina: falta configurar la conexión.',
    INVALID_CONFIGURATION: 'RFN Argentina: revisar la configuración de conexión o el período.',
    UNAUTHORIZED: 'RFN Argentina: acceso a la fuente rechazado. Revisar la credencial privada.',
    UNAVAILABLE: 'RFN Argentina no disponible o con tiempo de espera agotado. Intentá nuevamente.',
    INVALID_RESPONSE: 'RFN Argentina: respuesta incompatible. No se muestran importes.',
    SOURCE_MISMATCH: 'RFN Argentina: la identidad de la fuente no coincide.',
    INCONSISTENT_TOTALS: 'RFN Argentina: los importes no coinciden. No se muestran totales.',
    PERIOD_MISMATCH: 'RFN Argentina: el período devuelto no coincide con los límites argentinos solicitados.',
  };
  return messages[error.code];
}
export async function loadRfnSummary(period: RfnDateRange) {
  await requireOwner();
  try { await getRfnIdentity(); return { ok: true as const, summary: await getRfnSummary(period) }; }
  catch (error) { return { ok: false as const, message: integrationMessage(error) }; }
}
export async function loadRfnExpenses(period: RfnDateRange, options: RfnExpensesOptions) {
  await requireOwner();
  try { await getRfnIdentity(); return { ok: true as const, expenses: await getRfnExpenses(period, options) }; }
  catch (error) { return { ok: false as const, message: integrationMessage(error) }; }
}
