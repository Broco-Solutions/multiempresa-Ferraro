import { z } from "zod";

/** RFN exposes USD Decimal(14,2) as JSON strings, never JSON numbers. */
export const rfnUsdSchema = z
  .string()
  .regex(/^-?(?:0|[1-9]\d*)(?:\.\d{1,2})?$/, "INVALID_USD_DECIMAL");

const nonNegativeInt = z.number().int().nonnegative();
const datetime = z.string().datetime({ offset: true });

export const rfnCompanySchema = z.object({
  empresaId: z.string().min(1),
  empresaNombre: z.string().min(1),
  moneda: z.literal("USD"),
  version: z.literal(1),
});

export const rfnPeriodSchema = z.object({
  desde: datetime,
  hasta: datetime,
});

export const rfnIdentitySchema = rfnCompanySchema.extend({
  endpoints: z.array(z.string()),
  nota: z.string().optional(),
});

export const rfnSummarySchema = rfnCompanySchema.extend({
  periodo: rfnPeriodSchema,
  totales: z.object({
    ventasConfirmadas: z.object({
      cantidad: nonNegativeInt,
      monto: rfnUsdSchema,
    }),
    reservasActivas: z.object({
      cantidad: nonNegativeInt,
      monto: rfnUsdSchema,
      nota: z.string(),
    }),
    cobros: rfnUsdSchema,
    gastos: rfnUsdSchema,
    compras: rfnUsdSchema,
    egresos: rfnUsdSchema,
    resultadoNeto: rfnUsdSchema,
  }),
  gastosPorCategoria: z.array(
    z.object({
      categoria: z.string(),
      monto: rfnUsdSchema,
    }),
  ),
  alertasStock: z.object({
    stockBajo: nonNegativeInt,
    sinStock: nonNegativeInt,
  }),
});

export const rfnExpensesSchema = rfnCompanySchema.extend({
  periodo: rfnPeriodSchema,
  gastos: z.array(
    z.object({
      id: z.string().min(1),
      fecha: datetime,
      concepto: z.string(),
      importe: rfnUsdSchema,
      categoria: z.string(),
      medioPago: z.string(),
    }),
  ),
  totalDelFiltro: rfnUsdSchema,
  paginacion: z.object({
    total: nonNegativeInt,
    pagina: z.number().int().positive(),
    porPagina: z.number().int().positive().max(200),
    totalPaginas: z.number().int().positive(),
    hayMas: z.boolean(),
  }),
});

export type RfnIdentity = z.infer<typeof rfnIdentitySchema>;
export type RfnSummary = z.infer<typeof rfnSummarySchema>;
export type RfnExpenses = z.infer<typeof rfnExpensesSchema>;
