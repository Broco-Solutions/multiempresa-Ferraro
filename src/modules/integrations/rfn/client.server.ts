import 'server-only';
import { cache } from 'react';
import { requireOwner } from '@/modules/identity/session';
/**
 * Private RFN POS read-only API adapter.
 *
 * Import ONLY from server code (Server Components / server services).
 * Never export this module from a client component or a public, unprotected API.
 * No integration data may be shown publicly before owner authentication exists.
 */
import { z } from "zod";
import { assertRfnTotalsConsistent } from "./money";
import {
  rfnExpensesSchema,
  rfnIdentitySchema,
  rfnSummarySchema,
  type RfnExpenses,
  type RfnIdentity,
  type RfnSummary,
} from "./schema";

export type RfnErrorCode =
  | "NOT_CONFIGURED"
  | "INVALID_CONFIGURATION"
  | "UNAUTHORIZED"
  | "UNAVAILABLE"
  | "INVALID_RESPONSE"
  | "SOURCE_MISMATCH"
  | "INCONSISTENT_TOTALS"
  | "PERIOD_MISMATCH";

export class RfnIntegrationError extends Error {
  constructor(public readonly code: RfnErrorCode) {
    super(code);
    this.name = "RfnIntegrationError";
  }
}

export interface RfnDateRange {
  /** Business dates in YYYY-MM-DD format, inclusive. */
  desde: string;
  hasta: string;
}

export interface RfnExpensesOptions {
  pagina?: number;
  porPagina?: number;
  categoria?: string;
}

function config() {
  const rawUrl = process.env.RFN_API_BASE_URL?.trim();
  const key = process.env.RFN_API_KEY;
  if (!rawUrl || !key) throw new RfnIntegrationError("NOT_CONFIGURED");
  if (key.length < 32) throw new RfnIntegrationError("INVALID_CONFIGURATION");

  let baseUrl: URL;
  try {
    baseUrl = new URL(rawUrl);
  } catch {
    throw new RfnIntegrationError("INVALID_CONFIGURATION");
  }

  const isLocal =
    process.env.NODE_ENV !== "production" &&
    baseUrl.protocol === "http:" &&
    ["localhost", "127.0.0.1", "::1"].includes(baseUrl.hostname);

  if (
    (baseUrl.protocol !== "https:" && !isLocal) ||
    baseUrl.username ||
    baseUrl.password ||
    baseUrl.search ||
    baseUrl.hash ||
    baseUrl.pathname !== "/"
  ) {
    throw new RfnIntegrationError("INVALID_CONFIGURATION");
  }

  return {
    baseUrl,
    key,
    expectedCompanyId: process.env.RFN_EXPECTED_COMPANY_ID || "rfn-argentina",
  };
}

function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T12:00:00.000Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function periodParams(period: RfnDateRange): URLSearchParams {
  if (!isDateKey(period.desde) || !isDateKey(period.hasta) || period.desde > period.hasta) {
    throw new RfnIntegrationError("INVALID_CONFIGURATION");
  }
  return new URLSearchParams({
    periodo: "rango",
    desde: period.desde,
    hasta: period.hasta,
  });
}

/** RFN must return inclusive business-day boundaries in Argentina (UTC-03). */
function assertRequestedPeriod(received: { desde: string; hasta: string }, requested: RfnDateRange) {
  const expectedFrom = Date.parse(requested.desde + 'T00:00:00.000-03:00');
  const expectedTo = Date.parse(requested.hasta + 'T23:59:59.999-03:00');
  if (Date.parse(received.desde) !== expectedFrom || Date.parse(received.hasta) !== expectedTo) {
    throw new RfnIntegrationError('PERIOD_MISMATCH');
  }
}

async function get<T extends { empresaId: string; moneda: "USD"; version: 1 }>(
  resource: "identidad" | "resumen" | "gastos",
  schema: z.ZodType<T>,
  params = new URLSearchParams(),
): Promise<T> {
  const settings = config();
  const url = new URL("/api/consolidado/" + resource, settings.baseUrl);
  url.search = params.toString();

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "x-api-key": settings.key,
      },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new RfnIntegrationError("UNAVAILABLE");
  }

  if (response.status === 401 || response.status === 403) {
    throw new RfnIntegrationError("UNAUTHORIZED");
  }
  if (!response.ok) throw new RfnIntegrationError("UNAVAILABLE");
  if (!(response.headers.get("content-type") ?? "").includes("application/json")) {
    throw new RfnIntegrationError("INVALID_RESPONSE");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new RfnIntegrationError("INVALID_RESPONSE");
  }

  const result = schema.safeParse(payload);
  if (!result.success) throw new RfnIntegrationError("INVALID_RESPONSE");
  if (result.data.empresaId !== settings.expectedCompanyId) {
    throw new RfnIntegrationError("SOURCE_MISMATCH");
  }
  return result.data;
}

// Request-scoped only; rejected identity checks are also reused in this render.
const identityForRequest = cache(() => get("identidad", rfnIdentitySchema));

/** Can check the RFN connection without querying financial data. */
export async function getRfnIdentity(): Promise<RfnIdentity> {
  await requireOwner();
  return identityForRequest();
}

/**
 * The dashboard expenses are exactly RFN's egresos = gastos + compras.
 * Paid salaries already belong to gastos. Do not add either a second time.
 */
export async function getRfnSummary(period: RfnDateRange): Promise<RfnSummary> {
  await requireOwner();
  const summary = await get("resumen", rfnSummarySchema, periodParams(period));
  assertRequestedPeriod(summary.periodo, period);
  try {
    assertRfnTotalsConsistent(summary.totales);
  } catch {
    throw new RfnIntegrationError("INCONSISTENT_TOTALS");
  }
  return summary;
}

/**
 * RFN's /gastos lists operational expenses including salary payments.
 * It does NOT list purchased merchandise, individual customer receipts or
 * month-by-month financial history. Those require future source API endpoints.
 */
export async function getRfnExpenses(
  period: RfnDateRange,
  options: RfnExpensesOptions = {},
): Promise<RfnExpenses> {
  await requireOwner();
  const params = periodParams(period);
  const pagina = options.pagina ?? 1;
  const porPagina = options.porPagina ?? 100;

  if (!Number.isInteger(pagina) || pagina < 1 || !Number.isInteger(porPagina) ||
      porPagina < 1 || porPagina > 200) {
    throw new RfnIntegrationError("INVALID_CONFIGURATION");
  }

  params.set("pagina", String(pagina));
  params.set("porPagina", String(porPagina));
  if (options.categoria !== undefined) {
    const categoria = options.categoria.trim();
    if (!categoria || categoria.length > 100) {
      throw new RfnIntegrationError("INVALID_CONFIGURATION");
    }
    params.set("categoria", categoria);
  }

  const result = await get("gastos", rfnExpensesSchema, params);
  assertRequestedPeriod(result.periodo, period);
  if (result.paginacion.pagina !== pagina || result.paginacion.porPagina !== porPagina ||
      (options.categoria !== undefined && result.gastos.some(row => row.categoria !== options.categoria!.trim()))) {
    throw new RfnIntegrationError('INVALID_RESPONSE');
  }
  return result;
}
