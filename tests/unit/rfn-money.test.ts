import { describe, expect, it } from "vitest";
import {
  assertRfnTotalsConsistent,
  centsToUsd,
  usdToCents,
} from "../../src/modules/integrations/rfn/money";

describe("RFN exact USD arithmetic", () => {
  it("converts decimal strings to cents without floating-point loss", () => {
    expect(usdToCents("0")).toBe(0n);
    expect(usdToCents("0.01")).toBe(1n);
    expect(usdToCents("123.4")).toBe(12340n);
    expect(usdToCents("-40.19")).toBe(-4019n);
    expect(centsToUsd(-4019n)).toBe("-40.19");
    expect(centsToUsd(12340n)).toBe("123.40");
  });

  it("rejects mixed-precision or non-decimal amounts", () => {
    expect(() => usdToCents("1.001")).toThrow("INVALID_USD_DECIMAL");
    expect(() => usdToCents("1e4")).toThrow("INVALID_USD_DECIMAL");
    expect(() => usdToCents("NaN")).toThrow("INVALID_USD_DECIMAL");
  });

  it("includes purchases once and computes net exactly", () => {
    expect(() =>
      assertRfnTotalsConsistent({
        cobros: "99.99",
        gastos: "30.10",
        compras: "10.20",
        egresos: "40.30",
        resultadoNeto: "59.69",
      }),
    ).not.toThrow();
  });

  it("rejects a duplicate purchase or inconsistent net", () => {
    expect(() =>
      assertRfnTotalsConsistent({
        cobros: "100",
        gastos: "30",
        compras: "20",
        egresos: "70",
        resultadoNeto: "30",
      }),
    ).toThrow("RFN_EXPENSE_TOTAL_MISMATCH");
    expect(() =>
      assertRfnTotalsConsistent({
        cobros: "100",
        gastos: "30",
        compras: "20",
        egresos: "50",
        resultadoNeto: "40",
      }),
    ).toThrow("RFN_NET_TOTAL_MISMATCH");
  });
});
