import { describe, expect, it } from 'vitest';
import { currentMonth, readPeriod, readExpensesOptions } from '../../src/modules/integrations/rfn/period';
describe('Argentine periods and filters', () => {
  it('uses Argentine month at the UTC boundary and handles leap years', () => {
    expect(currentMonth(new Date('2026-11-01T01:00:00Z'))).toEqual({ desde: '2026-10-01', hasta: '2026-10-31' });
    expect(currentMonth(new Date('2028-02-10T12:00:00Z'))).toEqual({ desde: '2028-02-01', hasta: '2028-02-29' });
  });
  it('rejects invalid, reversed, partial or array dates without querying a different period', () => {
    for (const params of [{ desde: '2026-02-30', hasta: '2026-03-01' }, { desde: '2026-04-02', hasta: '2026-04-01' }, { desde: '2026-01-01' }, { desde: ['2026-01-01'], hasta: '2026-01-31' }]) expect(() => readPeriod(params)).toThrow();
    expect(() => readExpensesOptions({ pagina: '-1' })).toThrow();
    expect(readExpensesOptions({ categoria: 'Sueldos' })).toMatchObject({ pagina: 1, porPagina: 25, categoria: 'Sueldos' });
  });
});
