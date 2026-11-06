import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requireOwner } from '../../src/modules/identity/session';
import {
  getRfnExpenses,
  getRfnIdentity,
  getRfnSummary,
} from "../../src/modules/integrations/rfn/client.server";

vi.mock('server-only', () => ({}));
vi.mock('../../src/modules/identity/session', () => ({ requireOwner: vi.fn(async () => ({ user: { id: 'isolated-owner' } })) }));

const range = { desde: "2026-10-01", hasta: "2026-10-31" };
const metadata = {
  empresaId: "rfn-argentina",
  empresaNombre: "RFN Argentina",
  moneda: "USD",
  version: 1,
};
const periodo = {
  desde: "2026-10-01T03:00:00.000Z",
  hasta: "2026-11-01T02:59:59.999Z",
};

const summary = {
  ...metadata,
  periodo,
  totales: {
    ventasConfirmadas: { cantidad: 1, monto: "100.00" },
    reservasActivas: { cantidad: 0, monto: "0", nota: "Current reservations" },
    cobros: "100.00",
    gastos: "30.10",
    compras: "10.20",
    egresos: "40.30",
    resultadoNeto: "59.70",
  },
  gastosPorCategoria: [{ categoria: "Sueldos", monto: "30.10" }],
  alertasStock: { stockBajo: 0, sinStock: 0 },
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.stubEnv("RFN_API_BASE_URL", "https://gestion.rfn-argentina.com/");
  vi.stubEnv("RFN_API_KEY", "test-secret-at-least-32-characters-long");
  vi.stubEnv("RFN_EXPECTED_COMPANY_ID", "rfn-argentina");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("RFN read-only API client", () => {
  it('never contacts RFN when authorization fails', async () => {
    const fakeFetch = vi.fn();
    vi.stubGlobal('fetch', fakeFetch);
    vi.mocked(requireOwner).mockRejectedValueOnce(new Error('REDIRECT_LOGIN'));
    await expect(getRfnSummary(range)).rejects.toThrow('REDIRECT_LOGIN');
    expect(fakeFetch).not.toHaveBeenCalled();
  });
  it('authenticates identity access before the request memoization boundary', async () => {
    const fakeFetch = vi.fn();
    vi.stubGlobal('fetch', fakeFetch);
    vi.mocked(requireOwner).mockRejectedValueOnce(new Error('REDIRECT'));
    await expect(getRfnIdentity()).rejects.toThrow('REDIRECT');
    expect(fakeFetch).not.toHaveBeenCalled();
  });
  it('rejects UTC day boundaries instead of silently shifting Argentine totals', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ ...summary, periodo: { desde: '2026-10-01T00:00:00.000Z', hasta: '2026-10-31T23:59:59.999Z' } })));
    await expect(getRfnSummary(range)).rejects.toMatchObject({ code: 'PERIOD_MISMATCH' });
  });
  it("checks identity with a private header and no shared cache", async () => {
    const fakeFetch = vi.fn<(url: URL, options: RequestInit) => Promise<Response>>(async () => json({
      ...metadata,
      endpoints: ["GET /api/consolidado/resumen"],
    }));
    vi.stubGlobal("fetch", fakeFetch);

    const result = await getRfnIdentity();
    expect(result.empresaId).toBe("rfn-argentina");
    expect(fakeFetch).toHaveBeenCalledTimes(1);

    const [url, options] = fakeFetch.mock.calls[0]!;
    expect(String(url)).toContain("/api/consolidado/identidad");
    expect(options.method).toBe("GET");
    expect(new Headers(options.headers).get("x-api-key")).toBe("test-secret-at-least-32-characters-long");
    expect(options.cache).toBe("no-store");
  });

  it("fetches the requested range and keeps amount strings intact", async () => {
    const fakeFetch = vi.fn<(url: URL, options: RequestInit) => Promise<Response>>(async () => json(summary));
    vi.stubGlobal("fetch", fakeFetch);

    const result = await getRfnSummary(range);
    expect(result.totales.egresos).toBe("40.30");
    const [url] = fakeFetch.mock.calls[0]!;
    expect(url.searchParams.get("periodo")).toBe("rango");
    expect(url.searchParams.get("desde")).toBe("2026-10-01");
    expect(url.searchParams.get("hasta")).toBe("2026-10-31");
  });

  it("fetches expense detail without claiming it includes purchases", async () => {
    const fakeFetch = vi.fn<(url: URL, options: RequestInit) => Promise<Response>>(async () => json({
      ...metadata,
      periodo,
      gastos: [{
        id: "gasto-1",
        fecha: "2026-10-15T12:00:00.000Z",
        concepto: "Pago de sueldo",
        importe: "30.10",
        categoria: "Sueldos",
        medioPago: "Transferencia",
      }],
      totalDelFiltro: "30.10",
      paginacion: {
        total: 1,
        pagina: 1,
        porPagina: 3,
        totalPaginas: 1,
        hayMas: false,
      },
    }));
    vi.stubGlobal("fetch", fakeFetch);

    const result = await getRfnExpenses(range, { porPagina: 3, categoria: "Sueldos" });
    expect(result.gastos[0]?.categoria).toBe("Sueldos");
    const [url] = fakeFetch.mock.calls[0]!;
    expect(url.searchParams.get("categoria")).toBe("Sueldos");
    expect(url.searchParams.get("porPagina")).toBe("3");
  });

  it("fails closed if configuration is missing or insecure", async () => {
    vi.stubEnv("RFN_API_KEY", "");
    await expect(getRfnSummary(range)).rejects.toMatchObject({ code: "NOT_CONFIGURED" });

    vi.stubEnv("RFN_API_KEY", "test-secret-at-least-32-characters-long");
    vi.stubEnv("RFN_API_BASE_URL", "http://untrusted.example.com");
    await expect(getRfnSummary(range)).rejects.toMatchObject({
      code: "INVALID_CONFIGURATION",
    });
  });

  it("rejects credentials errors, invalid data and a wrong business identity", async () => {
    vi.stubGlobal("fetch", vi.fn<(url: URL, options: RequestInit) => Promise<Response>>(async () => json({ error: "No autorizado" }, 401)));
    await expect(getRfnSummary(range)).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    vi.stubGlobal("fetch", vi.fn<(url: URL, options: RequestInit) => Promise<Response>>(async () => json({ ...summary, moneda: "ARS" })));
    await expect(getRfnSummary(range)).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });

    vi.stubGlobal("fetch", vi.fn<(url: URL, options: RequestInit) => Promise<Response>>(async () => json({ ...summary, empresaId: "otro-negocio" })));
    await expect(getRfnSummary(range)).rejects.toMatchObject({
      code: "SOURCE_MISMATCH",
    });
  });

  it("rejects inconsistent source totals and bad requested dates", async () => {
    vi.stubGlobal("fetch", vi.fn<(url: URL, options: RequestInit) => Promise<Response>>(async () => json({
      ...summary,
      totales: { ...summary.totales, egresos: "50.30" },
    })));
    await expect(getRfnSummary(range)).rejects.toMatchObject({
      code: "INCONSISTENT_TOTALS",
    });

    await expect(getRfnSummary({ desde: "2026-02-31", hasta: "2026-03-01" }))
      .rejects.toMatchObject({ code: "INVALID_CONFIGURATION" });
  });

  it("does not silently accept a fallback to another month", async () => {
    vi.stubGlobal("fetch", vi.fn<(url: URL, options: RequestInit) => Promise<Response>>(async () => json({
      ...summary,
      periodo: {
        desde: "2026-11-01T00:00:00.000Z",
        hasta: "2026-11-30T23:59:59.999Z",
      },
    })));
    await expect(getRfnSummary(range)).rejects.toMatchObject({
      code: "PERIOD_MISMATCH",
    });
  });

  it("reports unavailable services without treating them as zero", async () => {
    vi.stubGlobal("fetch", vi.fn<(url: URL, options: RequestInit) => Promise<Response>>(async () => { throw new Error("timeout"); }));
    await expect(getRfnSummary(range)).rejects.toMatchObject({ code: "UNAVAILABLE" });
  });
});

it.each(['cobros', 'compras'] as const)('validates %s detail, identity, order, pagination and security', async resource => {
  const { getRfnMovements } = await import('../../src/modules/integrations/rfn/client.server');
  const row = { id: 'movement-2', fecha: '2026-10-15T12:00:00.000Z', tipo: resource === 'cobros' ? 'SENIA' : 'COMPRA_RECIBIDA', reversion: false, importeUsd: '0.10' };
  const payload = { ...metadata, periodo, movimientos: [row], paginacion: { pagina: 1, porPagina: 25, total: 1, totalPaginas: 1, hayMas: false } };
  const f = vi.fn(async (url: URL) => json(url.pathname.endsWith('/identidad') ? { ...metadata, endpoints: [] } : payload));
  vi.stubGlobal('fetch', f);
  const r = await getRfnMovements(resource, range);
  expect(r.movimientos[0]?.importeUsd).toBe('0.10');
  expect(f.mock.calls.at(-1)![0].pathname).toBe('/api/consolidado/' + resource);
  for (const change of [{ moneda: 'ARS' }, { version: 2 }, { empresaId: 'wrong' },
    { movimientos: [{ ...row, importeUsd: '-1' }] }, { movimientos: [{ ...row, reversion: true }] },
    { movimientos: [{ ...row, cliente: 'PRIVATE' }] }, { movimientos: [{ ...row, tipo: 'VENTA' }] },
    { movimientos: [{ ...row, fecha: '2026-11-15T00:00:00Z' }] },
    { periodo: { ...periodo, desde: '2026-10-01T00:00:00.000Z' } },
    { paginacion: { ...payload.paginacion, total: 26 } },
  ]) {
    f.mockImplementation(async url => json(url.pathname.endsWith('/identidad') ? { ...metadata, endpoints: [] } : { ...payload, ...change }));
    await expect(getRfnMovements(resource, range)).rejects.toThrow();
  }
  f.mockResolvedValue(json({}, 401)); await expect(getRfnMovements(resource, range)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  f.mockClear();
  vi.mocked(requireOwner).mockRejectedValueOnce(new Error('LOGIN'));
  await expect(getRfnMovements(resource, range)).rejects.toThrow('LOGIN'); expect(f).not.toHaveBeenCalled();
});

it('reconciles all controlled collection, purchase and operational expense pages with RFN summary', async () => {
  const { getRfnMovements, assertMovementPage } = await import('../../src/modules/integrations/rfn/client.server');
  const { usdToCents } = await import('../../src/modules/integrations/rfn/money');
  const controlledSummary = { ...summary, totales: { ...summary.totales, cobros: '6.10', compras: '12.20', gastos: '18.30', egresos: '30.50', resultadoNeto: '-24.40' } };
  vi.stubGlobal('fetch', vi.fn(async (url: URL) => {
    const resource = url.pathname.split('/').at(-1);
    if (resource === 'identidad') return json({ ...metadata, endpoints: [] });
    if (resource === 'resumen') return json(controlledSummary);
    const page = Number(url.searchParams.get('pagina'));
    const rows = Array.from({ length: 61 }, (_, i) => ({ id: 'movement-' + String(100-i).padStart(3,'0'), fecha: '2026-10-15T12:00:00.000Z',
      tipo: resource === 'cobros' ? (i % 2 ? 'COBRO' : 'SENIA') : 'COMPRA_RECIBIDA', reversion: false,
      importeUsd: resource === 'cobros' ? '0.10' : '0.20' })).slice((page-1)*25,page*25);
    return json({ ...metadata, periodo,
      ...(resource === 'gastos' ? { gastos: rows.map(r => ({ id: r.id, fecha: r.fecha, concepto: 'PRIVATE', categoria: 'Sueldos', medioPago: 'PRIVATE', importe: '0.30' })), totalDelFiltro: '18.30' } : { movimientos: rows }),
      paginacion: { pagina: page, porPagina: 25, total: 61, totalPaginas: 3, hayMas: page < 3 } });
  }));
  const totals = (await getRfnSummary(range)).totales;
  for (const flow of ['cobros', 'compras', 'gastos'] as const) {
    let amount = 0n;
    for (let page = 1; page <= 3; page++) {
      if (flow === 'gastos') {
        const r = await getRfnExpenses(range, { pagina: page, porPagina: 25 });
        const rows = r.gastos.map(row => ({ ...row, importeUsd: row.importe }));
        assertMovementPage(rows, r.paginacion, range, page);
        amount += rows.reduce((sum, row) => sum + usdToCents(row.importeUsd), 0n);
      } else {
        const r = await getRfnMovements(flow, range, page);
        amount += r.movimientos.reduce((sum, row) => sum + usdToCents(row.importeUsd), 0n);
      }
    }
    expect(amount).toBe(usdToCents(totals[flow]));
  }
});
