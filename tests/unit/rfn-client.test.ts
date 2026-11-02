import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getRfnExpenses,
  getRfnIdentity,
  getRfnSummary,
} from "../../src/modules/integrations/rfn/client.server";

const range = { desde: "2026-10-01", hasta: "2026-10-31" };
const metadata = {
  empresaId: "rfn-argentina",
  empresaNombre: "RFN Argentina",
  moneda: "USD",
  version: 1,
};
const periodo = {
  desde: "2026-10-01T00:00:00.000Z",
  hasta: "2026-10-31T23:59:59.999Z",
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
  it("checks identity with a private header and no shared cache", async () => {
    const fakeFetch = vi.fn(async () => json({
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
    expect(options.headers["x-api-key"]).toBe("test-secret-at-least-32-characters-long");
    expect(options.cache).toBe("no-store");
  });

  it("fetches the requested range and keeps amount strings intact", async () => {
    const fakeFetch = vi.fn(async () => json(summary));
    vi.stubGlobal("fetch", fakeFetch);

    const result = await getRfnSummary(range);
    expect(result.totales.egresos).toBe("40.30");
    const [url] = fakeFetch.mock.calls[0]!;
    expect(url.searchParams.get("periodo")).toBe("rango");
    expect(url.searchParams.get("desde")).toBe("2026-10-01");
    expect(url.searchParams.get("hasta")).toBe("2026-10-31");
  });

  it("fetches expense detail without claiming it includes purchases", async () => {
    const fakeFetch = vi.fn(async () => json({
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
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "No autorizado" }, 401)));
    await expect(getRfnSummary(range)).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    vi.stubGlobal("fetch", vi.fn(async () => json({ ...summary, moneda: "ARS" })));
    await expect(getRfnSummary(range)).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });

    vi.stubGlobal("fetch", vi.fn(async () => json({ ...summary, empresaId: "otro-negocio" })));
    await expect(getRfnSummary(range)).rejects.toMatchObject({
      code: "SOURCE_MISMATCH",
    });
  });

  it("rejects inconsistent source totals and bad requested dates", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({
      ...summary,
      totales: { ...summary.totales, egresos: "50.30" },
    })));
    await expect(getRfnSummary(range)).rejects.toMatchObject({
      code: "INCONSISTENT_TOTALS",
    });

    await expect(getRfnSummary({ desde: "2026-02-31", hasta: "2026-03-01" }))
      .rejects.toMatchObject({ code: "INVALID_CONFIGURATION" });
  });

  it("reports unavailable services without treating them as zero", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("timeout"); }));
    await expect(getRfnSummary(range)).rejects.toMatchObject({ code: "UNAVAILABLE" });
  });
});
