import 'server-only';
import { z } from 'zod';
import { requireOwner } from '@/modules/identity/session';
export type Source = 'ferraro-detail' | 'ppf-house';
export type Period = { desde: string; hasta: string };
const identity = z.object({ version: z.literal(1), empresaId: z.string(), moneda: z.literal('USD') }).strict();
const summary = identity.extend({ periodo: z.object({ desde: z.iso.datetime(), hasta: z.iso.datetime() }).strict(), cobros: z.string().regex(/^-?(0|[1-9]\d*)\.\d{2}$/), movimientos: z.number().int().nonnegative() });
export type Result = { ok: true; cobros: string; movimientos: number } | { ok: false; message: string };
export async function loadCustomerReceipts(source: Source, period: Period): Promise<Result> {
  await requireOwner();
  try {
    const prefix = source === 'ferraro-detail' ? 'FERRARO' : 'PPF';
    const base = process.env[prefix + '_API_BASE_URL'];
    const key = process.env[prefix + '_API_KEY'];
    if (!base || !key) return { ok: false, message: 'Pendiente de configurar conexión.' };
    const url = new URL(base);
    const local = process.env.NODE_ENV !== 'production' && url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (key.length < 32 || (url.protocol !== 'https:' && !local) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Configuración inválida.');
    for (const value of [period.desde, period.hasta]) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(value + 'T12:00:00Z').toISOString().slice(0,10) !== value) throw new Error('Período inválido.');
    }
    if (period.desde > period.hasta) throw new Error('Período inválido.');
    async function get(resource: string) {
      const target = new URL('/api/consolidado/' + resource, url);
      if (resource === 'resumen') target.search = new URLSearchParams({ periodo: 'rango', ...period }).toString();
      const response = await fetch(target, { method: 'GET', headers: { Accept: 'application/json', 'x-api-key': key! }, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000) });
      if (response.status === 401 || response.status === 403) throw new Error('Acceso rechazado por la fuente.');
      if (!response.ok) throw new Error('Fuente no disponible.');
      if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Respuesta incompatible.');
      return response.json();
    }
    const who = identity.parse(await get('identidad'));
    const data = summary.parse(await get('resumen'));
    if (who.empresaId !== source || data.empresaId !== source) throw new Error('Identidad incompatible.');
    if (Date.parse(data.periodo.desde) !== Date.parse(period.desde + 'T00:00:00.000-03:00') || Date.parse(data.periodo.hasta) !== Date.parse(period.hasta + 'T23:59:59.999-03:00')) throw new Error('Período incompatible.');
    if (data.movimientos === 0 && BigInt(data.cobros.replace('.', '')) !== 0n) throw new Error('Respuesta incompatible.');
    return { ok: true, cobros: data.cobros, movimientos: data.movimientos };
  } catch {
    return { ok: false, message: 'Conexión fallida o respuesta no validada. No se muestran importes.' };
  }
}
export const loadFerraroReceipts = (period: Period) => loadCustomerReceipts('ferraro-detail', period);
export const loadPpfReceipts = (period: Period) => loadCustomerReceipts('ppf-house', period);
