import 'server-only';
import { cache } from 'react';
import { z } from 'zod';
import { requireOwner } from '@/modules/identity/session';
import { usdToCents } from '@/modules/integrations/rfn/money';
export type Source = 'ferraro-detail' | 'ppf-house';
export type Period = { desde: string; hasta: string };
const identity = z.object({ version: z.literal(1), empresaId: z.string(), moneda: z.literal('USD') }).strict();
const summary = identity.extend({ periodo: z.object({ desde: z.iso.datetime(), hasta: z.iso.datetime() }).strict(), cobros: z.string().regex(/^-?(0|[1-9]\d*)\.\d{2}$/), movimientos: z.number().int().nonnegative() });
export type Result = { ok: true; cobros: string; movimientos: number } | { ok: false; message: string };
// Configuration is checked on every entry; identity and failures live only in
// React's current server request. Financial payloads are always validated below.
const identityForRequest = cache(async (source: Source, base: string, key: string) => {
  const response = await fetch(new URL('/api/consolidado/identidad', base), { method: 'GET', headers: { Accept: 'application/json', 'x-api-key': key }, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000) });
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('Identidad no disponible.');
  const who = identity.parse(await response.json());
  if (who.empresaId !== source) throw new Error('Identidad incompatible.');
  return who;
});
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
    const who = await identityForRequest(source, url.origin, key);
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

const expenseMoney = z.string().regex(/^-?(0|[1-9]\d*)\.\d{2}$/);
const expensesSchema = identity.extend({
  periodo: z.object({ desde: z.iso.datetime(), hasta: z.iso.datetime() }).strict(),
  totales: z.object({ compras: expenseMoney, gastosManuales: expenseMoney, sueldosPagados: expenseMoney, egresos: expenseMoney }).strict(),
  movimientos: z.array(z.object({
    id: z.uuid(), fecha: z.iso.datetime(),
    tipo: z.enum(['PURCHASE', 'MANUAL_EXPENSE', 'SALARY_PAYMENT']),
    reversion: z.boolean(), importeUsd: expenseMoney,
  }).strict()).max(25),
  paginacion: z.object({
    pagina: z.number().int().min(1).max(1000000), porPagina: z.literal(25),
    total: z.number().int().nonnegative(), totalPaginas: z.number().int().positive(), hayMas: z.boolean(),
  }).strict(),
});
export type CustomerExpenses = z.infer<typeof expensesSchema>;
export type ExpensesResult = { ok: true; expenses: CustomerExpenses } | { ok: false; message: string; reason: 'UNAVAILABLE' | 'PERIOD_MISMATCH' | 'INVALID_RESPONSE' };

/** Separate from receipts: the existing receipts contract stays unchanged. */
export async function loadCustomerExpenses(source: Source, period: Period, page = 1, verifyIdentity = false): Promise<ExpensesResult> {
  await requireOwner();
  const unavailable = (message: string): ExpensesResult => ({ ok: false, message, reason: 'UNAVAILABLE' });
  try {
    if (!Number.isSafeInteger(page) || page < 1 || page > 1000000 ||
        !z.object({ desde: z.iso.date(), hasta: z.iso.date() }).safeParse(period).success || period.desde > period.hasta) {
      return { ok: false, reason: 'INVALID_RESPONSE', message: 'Período o página inválidos. No se muestran importes.' };
    }
    const data = expensesSchema.parse(await customerDetailPayload(source, period, page, 'egresos', verifyIdentity));
    if (data.empresaId !== source) throw new Error('INVALID_RESPONSE');
    const from = Date.parse(period.desde + 'T00:00:00.000-03:00');
    const to = Date.parse(period.hasta + 'T23:59:59.999-03:00');
    if (Date.parse(data.periodo.desde) !== from || Date.parse(data.periodo.hasta) !== to) {
      return { ok: false, reason: 'PERIOD_MISMATCH', message: 'Período incompatible: la fuente no devuelve los límites argentinos solicitados. No se muestran importes.' };
    }
    const cents = usdToCents;
    const { compras, gastosManuales, sueldosPagados, egresos } = data.totales;
    if (cents(egresos) !== cents(compras) + cents(gastosManuales) + cents(sueldosPagados)) throw new Error('INVALID_RESPONSE');
    const pagination = data.paginacion;
    const count = Math.min(25, Math.max(0, pagination.total - (page - 1) * 25));
    if (pagination.pagina !== page || pagination.totalPaginas !== Math.max(1, Math.ceil(pagination.total / 25)) ||
        pagination.hayMas !== (page < pagination.totalPaginas) || data.movimientos.length !== count ||
        new Set(data.movimientos.map(row => row.id)).size !== count ||
        (pagination.total === 0 && Object.values(data.totales).some(value => cents(value) !== 0n))) throw new Error('INVALID_RESPONSE');
    for (const [index, row] of data.movimientos.entries()) {
      const date = Date.parse(row.fecha);
      const prior = data.movimientos[index - 1];
      if (date < from || date > to || (row.reversion ? cents(row.importeUsd) > 0n : cents(row.importeUsd) < 0n) ||
          (prior && (date > Date.parse(prior.fecha) || (date === Date.parse(prior.fecha) && row.id > prior.id)))) throw new Error('INVALID_RESPONSE');
    }
    return { ok: true, expenses: data };
  } catch (error) {
    if (error instanceof z.ZodError || (error instanceof Error && error.message === 'INVALID_RESPONSE')) {
      return { ok: false, reason: 'INVALID_RESPONSE', message: 'Respuesta incompatible o importes no validados. No se muestran importes.' };
    }
    if (error instanceof CustomerUnavailableError) return unavailable(error.message);
    return unavailable('Conexión fallida o respuesta no validada. No se muestran importes.');
  }
}
export const loadFerraroExpenses = (period: Period, page = 1) => loadCustomerExpenses('ferraro-detail', period, page);
export const loadPpfExpenses = (period: Period, page = 1) => loadCustomerExpenses('ppf-house', period, page);

class CustomerUnavailableError extends Error {}

async function customerDetailPayload(source: Source, period: Period, page: number, resource: 'cobros' | 'egresos', verifyIdentity = false) {
    const prefix = source === 'ferraro-detail' ? 'FERRARO' : 'PPF';
    const base = process.env[prefix + '_API_BASE_URL'];
    const key = process.env[prefix + '_API_KEY'];
    if (!base || !key) throw new CustomerUnavailableError('Pendiente de configurar conexión.');
    const url = new URL(base);
    const local = process.env.NODE_ENV !== 'production' && url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (key.length < 32 || (url.protocol !== 'https:' && !local) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new CustomerUnavailableError('Configuración de conexión inválida. No se muestran importes.');
    }
    if (resource === 'cobros' || verifyIdentity) await identityForRequest(source, url.origin, key);
    url.pathname = '/api/consolidado/' + resource;
    url.search = new URLSearchParams({ periodo: 'rango', ...period, pagina: String(page) }).toString();
    const response = await fetch(url, { method: 'GET', headers: { Accept: 'application/json', 'x-api-key': key }, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000) });
    if (response.status === 401 || response.status === 403) throw new CustomerUnavailableError('Acceso rechazado por la fuente. No se muestran importes.');
    if (!response.ok) throw new CustomerUnavailableError('Fuente no disponible. No se muestran importes.');
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('INVALID_RESPONSE');
    return response.json();
}

const collectionsSchema = identity.extend({
  periodo: expensesSchema.shape.periodo,
  movimientos: z.array(z.object({
    id: z.uuid(), fecha: z.iso.datetime(), tipo: z.enum(['CUSTOMER_PAYMENT', 'CUSTOMER_REFUND']),
    reversion: z.boolean(), importeUsd: expenseMoney,
  }).strict()).max(25),
  paginacion: expensesSchema.shape.paginacion,
}).strict();
export async function loadCustomerCollections(source: Source, period: Period, page = 1) {
  await requireOwner();
  try {
    if (!Number.isSafeInteger(page) || page < 1 || page > 1000000 ||
        !z.object({ desde: z.iso.date(), hasta: z.iso.date() }).safeParse(period).success || period.desde > period.hasta) throw new Error('INVALID_FILTER');
    const data = collectionsSchema.parse(await customerDetailPayload(source, period, page, 'cobros'));
    const from = Date.parse(period.desde + 'T00:00:00.000-03:00');
    const to = Date.parse(period.hasta + 'T23:59:59.999-03:00');
    const p = data.paginacion;
    const count = Math.min(25, Math.max(0, p.total - (page - 1) * 25));
    if (data.empresaId !== source || Date.parse(data.periodo.desde) !== from || Date.parse(data.periodo.hasta) !== to ||
        p.pagina !== page || !Number.isSafeInteger(p.total) || p.totalPaginas !== Math.max(1, Math.ceil(p.total / 25)) ||
        p.hayMas !== (page < p.totalPaginas) || data.movimientos.length !== count || new Set(data.movimientos.map(row => row.id)).size !== count) throw new Error('INVALID_RESPONSE');
    for (const [index, row] of data.movimientos.entries()) {
      const date = Date.parse(row.fecha), prior = data.movimientos[index - 1];
      const incoming = (row.tipo === 'CUSTOMER_PAYMENT') !== row.reversion;
      const cents = usdToCents(row.importeUsd);
      if (date < from || date > to || (incoming ? cents < 0n : cents > 0n) ||
          (prior && (date > Date.parse(prior.fecha) || (date === Date.parse(prior.fecha) && row.id > prior.id)))) throw new Error('INVALID_RESPONSE');
    }
    return { ok: true as const, collections: data };
  } catch { return { ok: false as const, message: 'Conexión fallida o respuesta no validada. No se muestran importes.' }; }
}
