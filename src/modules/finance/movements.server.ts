import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { companies } from '@/config/companies';
import { requireOwner } from '@/modules/identity/session';
import { readPeriod, type SearchParams } from '@/modules/integrations/rfn/period';
import { loadCustomerCollections, loadCustomerExpenses, type Period } from '@/modules/integrations/customer-receipts/client.server';
import { loadRfnExpenses, loadRfnMovements } from '@/modules/integrations/rfn/finance.server';
import { assertMovementPage } from '@/modules/integrations/rfn/client.server';
import { centsToUsd, usdToCents } from '@/modules/integrations/rfn/money';
import type { CompanyId } from './summary.server';

export type FinancialMovement = {
  empresaId: CompanyId; flujo: 'cobros' | 'egresos' | 'gastos' | 'compras';
  idOrigen: string; fecha: string; tipo: string; direccion: 'entrada' | 'salida';
  reversion: boolean; importeUsd: string;
};
export type MovementFilters = Period & { empresa: CompanyId | 'todas'; tipo: 'todos' | 'cobros' | 'egresos' };
export type MovementStream = { empresaId: CompanyId; flujo: FinancialMovement['flujo']; key: string };
export function movementStreams(filters: MovementFilters): MovementStream[] {
  return companies.filter(c => filters.empresa === 'todas' || filters.empresa === c.id).flatMap(c => {
    const flows: FinancialMovement['flujo'][] = [];
    if (filters.tipo !== 'egresos') flows.push('cobros');
    if (filters.tipo !== 'cobros') flows.push(...(c.id === 'rfn-argentina' ? ['gastos', 'compras'] as const : ['egresos'] as const));
    return flows.map(flujo => ({ empresaId: c.id, flujo, key: `${c.id}:${flujo}` }));
  });
}
const filterSchema = z.object({
  desde: z.iso.date(), hasta: z.iso.date(),
  empresa: z.enum(['todas', 'ferraro-detail', 'ppf-house', 'rfn-argentina']),
  tipo: z.enum(['todos', 'cobros', 'egresos']),
}).strict();
function signature(payload: string) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error('INVALID_FILTER');
  return createHmac('sha256', secret).update('multiempresa:movimientos:v1:' + payload).digest('base64url');
}
const cursorSchema = z.object({ v: z.literal(1), filtros: filterSchema, offsets: z.record(z.string(), z.number().int().min(0).max(25000000)) }).strict();
export function readMovementFilters(params: SearchParams) {
  if (Object.keys(params).some(key => !['desde', 'hasta', 'empresa', 'tipo', 'cursor'].includes(key))) throw new Error('INVALID_FILTER');
  const filters = filterSchema.parse({ ...readPeriod(params), empresa: params.empresa ?? 'todas', tipo: params.tipo ?? 'todos' });
  const streams = movementStreams(filters);
  let offsets = Object.fromEntries(streams.map(s => [s.key, 0]));
  if (params.cursor !== undefined) {
    const token = params.cursor;
    if (typeof token !== 'string' || token.length > 2048 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token)) throw new Error('INVALID_FILTER');
    const [payload, mac] = token.split('.') as [string, string];
    const expected = signature(payload);
    if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) throw new Error('INVALID_FILTER');
    const parsed = cursorSchema.parse(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')));
    if (JSON.stringify(parsed.filtros) !== JSON.stringify(filters) || Object.keys(parsed.offsets).sort().join() !== streams.map(s => s.key).sort().join()) throw new Error('INVALID_FILTER');
    const consumed = Object.values(parsed.offsets).reduce((a, b) => a + b, 0);
    if (consumed === 0 || consumed % 25 !== 0) throw new Error('INVALID_FILTER');
    offsets = parsed.offsets;
  }
  return { filters, offsets };
}
export const movementKey = (row: FinancialMovement) => `${row.empresaId}:${row.flujo}:${row.idOrigen}`;
const lexical = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
export function compareMovements(a: FinancialMovement, b: FinancialMovement) {
  return Date.parse(b.fecha) - Date.parse(a.fecha) || lexical(a.empresaId, b.empresaId) || lexical(a.flujo, b.flujo) || lexical(b.idOrigen, a.idOrigen);
}
type SourceRow = { id: string; fecha: string; tipo: string; reversion: boolean; importeUsd: string };
function normalize(stream: MovementStream, row: SourceRow): FinancialMovement {
  let incoming: boolean;
  if (stream.flujo === 'cobros') incoming = (row.tipo !== 'CUSTOMER_REFUND') !== row.reversion;
  else incoming = row.reversion;
  const amount = usdToCents(row.importeUsd);
  // Customer expenses use expense-account signs; collections already use cash signs.
  const signed = stream.flujo === 'cobros' ? amount : -amount;
  return { empresaId: stream.empresaId, flujo: stream.flujo, idOrigen: row.id, fecha: row.fecha,
    tipo: row.tipo, reversion: row.reversion, direccion: incoming ? 'entrada' : 'salida', importeUsd: centsToUsd(signed) };
}
async function sourcePage(stream: MovementStream, period: Period, page: number) {
  let rows: SourceRow[], hayMas: boolean;
  if (stream.empresaId !== 'rfn-argentina') {
    if (stream.flujo === 'cobros') {
      const r = await loadCustomerCollections(stream.empresaId, period, page);
      if (!r.ok) throw new Error('UNAVAILABLE');
      rows = r.collections.movimientos; hayMas = r.collections.paginacion.hayMas;
    } else {
      const r = await loadCustomerExpenses(stream.empresaId, period, page, true);
      if (!r.ok) throw new Error('UNAVAILABLE');
      rows = r.expenses.movimientos; hayMas = r.expenses.paginacion.hayMas;
    }
  } else if (stream.flujo === 'gastos') {
    const r = await loadRfnExpenses(period, { pagina: page, porPagina: 25 });
    if (!r.ok) throw new Error('UNAVAILABLE');
    rows = r.expenses.gastos.map(row => ({ id: row.id, fecha: row.fecha, tipo: 'GASTO_OPERATIVO', reversion: false, importeUsd: row.importe }));
    assertMovementPage(rows, r.expenses.paginacion, period, page);
    hayMas = r.expenses.paginacion.hayMas;
  } else {
    const r = await loadRfnMovements(stream.flujo === 'cobros' ? 'cobros' : 'compras', period, page);
    if (!r.ok) throw new Error('UNAVAILABLE');
    rows = r.data.movimientos; hayMas = r.data.paginacion.hayMas;
  }
  return { rows: rows.map(row => normalize(stream, row)), hayMas };
}
/** One head per stream: refill only an exhausted page needed for the next selection. */
export async function loadMovements(params: SearchParams) {
  await requireOwner();
  const { filters, offsets } = readMovementFilters(params);
  const streams = movementStreams(filters);
  const states = streams.map(stream => ({ stream, rows: [] as FinancialMovement[], index: offsets[stream.key] === 25000000 ? 25 : offsets[stream.key]! % 25, page: Math.min(1000000, Math.floor(offsets[stream.key]! / 25) + 1), hayMas: true, failed: false, loaded: false }));
  async function fill(state: typeof states[number]) {
    try {
      const previous = state.rows.at(-1);
      const result = await sourcePage(state.stream, { desde: filters.desde, hasta: filters.hasta }, state.page);
      if (previous && result.rows[0] && compareMovements(previous, result.rows[0]) >= 0) throw new Error('INVALID_ORDER');
      state.rows = result.rows; state.hayMas = result.hayMas; state.loaded = true;
      if (state.index > state.rows.length) throw new Error('INVALID_OFFSET');
    } catch { state.failed = true; state.rows = []; state.hayMas = false; }
  }
  await Promise.all(states.map(fill));
  const movements: FinancialMovement[] = [];
  while (movements.length < 25) {
    await Promise.all(states.filter(s => !s.failed && s.loaded && s.index === s.rows.length && s.hayMas).map(async s => { s.page++; s.index = 0; await fill(s); }));
    const candidates = states.filter(s => !s.failed && s.index < s.rows.length).sort((a, b) => compareMovements(a.rows[a.index]!, b.rows[b.index]!));
    const chosen = candidates[0];
    if (!chosen) break;
    movements.push(chosen.rows[chosen.index++]!); offsets[chosen.stream.key]!++;
  }
  const complete = states.every(s => !s.failed);
  const more = states.some(s => s.index < s.rows.length || s.hayMas);
  let nextCursor: string | null = null;
  if (complete && more && movements.length === 25) {
    const payload = Buffer.from(JSON.stringify({ v: 1, filtros: filters, offsets })).toString('base64url');
    nextCursor = payload + '.' + signature(payload);
  }
  return { movements, complete, nextCursor, sources: states.map(s => ({ ...s.stream, available: !s.failed })) };
}
