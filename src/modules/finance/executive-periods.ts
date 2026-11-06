import { argentinaTimeZone, readPeriod, type SearchParams } from '@/modules/integrations/rfn/period';

type Period = ReturnType<typeof readPeriod>;
const dayMs = 86_400_000;
const iso = (date: Date) => date.toISOString().slice(0, 10);
const calendarDate = (year: number, month: number, day: number) => {
  const date = new Date(0);
  date.setUTCFullYear(year, month, day);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};
const instant = (date: string) => new Date(`${date}T00:00:00Z`);

export function executivePresets(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: argentinaTimeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (name: string) => parts.find(value => value.type === name)!.value;
  const year = Number(part('year')), month = Number(part('month')) - 1;
  const today = `${part('year')}-${part('month')}-${part('day')}`;
  return [
    { id: 'this-month', label: 'Este mes', period: { desde: iso(calendarDate(year, month, 1)), hasta: today } },
    { id: 'last-month', label: 'Mes anterior', period: { desde: iso(calendarDate(year, month - 1, 1)), hasta: iso(calendarDate(year, month, 0)) } },
    { id: 'three-months', label: 'Últimos 3 meses', period: { desde: iso(calendarDate(year, month - 2, 1)), hasta: today } },
    { id: 'six-months', label: 'Últimos 6 meses', period: { desde: iso(calendarDate(year, month - 5, 1)), hasta: today } },
  ] as const;
}
export function activeExecutivePreset(period: Period, now = new Date()) {
  return executivePresets(now).find(preset => preset.period.desde === period.desde && preset.period.hasta === period.hasta);
}
export function readExecutivePeriod(params: SearchParams, now = new Date()): Period {
  return readPeriod(params.desde === undefined && params.hasta === undefined ? executivePresets(now)[0].period : params);
}
export function previousExecutivePeriod(period: Period, now = new Date()) {
  readPeriod(period);
  const preset = activeExecutivePreset(period, now);
  const start = instant(period.desde);
  const year = start.getUTCFullYear(), month = start.getUTCMonth();
  if (preset?.id === 'this-month' || preset?.id === 'last-month') {
    const last = calendarDate(year, month, 0);
    const requestedDay = instant(period.hasta).getUTCDate();
    const equivalent = preset.id === 'last-month' || requestedDay <= last.getUTCDate();
    const hasta = preset.id === 'last-month' ? last : calendarDate(year, month - 1, Math.min(requestedDay, last.getUTCDate()));
    return { period: readPeriod({ desde: iso(calendarDate(year, month - 1, 1)), hasta: iso(hasta) }), equivalent };
  }
  const duration = instant(period.hasta).getTime() - start.getTime() + dayMs;
  return { period: readPeriod({ desde: iso(new Date(start.getTime() - duration)), hasta: iso(new Date(start.getTime() - dayMs)) }), equivalent: true };
}
