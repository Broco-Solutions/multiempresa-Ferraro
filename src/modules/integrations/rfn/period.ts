import { z } from 'zod';
export type SearchParams = Record<string, string | string[] | undefined>;
export const argentinaTimeZone = 'America/Argentina/Buenos_Aires';
const date = z.iso.date();
export function currentMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: argentinaTimeZone, year: 'numeric', month: '2-digit' }).formatToParts(now);
  const year = parts.find(part => part.type === 'year')!.value;
  const month = parts.find(part => part.type === 'month')!.value;
  return { desde: `${year}-${month}-01`, hasta: `${year}-${month}-${new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate()}` };
}
export function readPeriod(params: SearchParams) {
  if (params.desde === undefined && params.hasta === undefined) return currentMonth();
  const result = z.object({ desde: date, hasta: date }).refine(value => value.desde <= value.hasta).safeParse(params);
  if (!result.success) throw new Error('INVALID_FILTER');
  return result.data;
}
export function readExpensesOptions(params: SearchParams) {
  const result = z.object({
    pagina: z.coerce.number().int().min(1).max(1000000).default(1),
    categoria: z.string().trim().min(1).max(100).optional(),
  }).safeParse({ pagina: params.pagina, categoria: params.categoria || undefined });
  if (!result.success) throw new Error('INVALID_FILTER');
  return { ...result.data, porPagina: 25 };
}
