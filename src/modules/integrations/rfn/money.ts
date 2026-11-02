/**
 * Monetary operations at the integration boundary. Never sum USD with JS floats.
 * RFN stores amounts with two fractional digits and serializes Decimal as text.
 */
const MONEY_PATTERN = /^(-?)(0|[1-9]\d*)(?:\.(\d{1,2}))?$/;

export function usdToCents(value: string): bigint {
  const match = MONEY_PATTERN.exec(value);
  if (!match) throw new Error("INVALID_USD_DECIMAL");

  const sign = match[1] === "-" ? -1n : 1n;
  const whole = BigInt(match[2]!);
  const fraction = BigInt((match[3] ?? "").padEnd(2, "0") || "0");

  return sign * (whole * 100n + fraction);
}

export function centsToUsd(value: bigint): string {
  const sign = value < 0n ? "-" : "";
  const abs = value < 0n ? -value : value;
  const dollars = abs / 100n;
  const fraction = (abs % 100n).toString().padStart(2, "0");
  return sign + dollars.toString() + "." + fraction;
}

export function assertRfnTotalsConsistent(totals: {
  cobros: string;
  gastos: string;
  compras: string;
  egresos: string;
  resultadoNeto: string;
}): void {
  const egresos = usdToCents(totals.egresos);
  if (usdToCents(totals.gastos) + usdToCents(totals.compras) !== egresos) {
    throw new Error("RFN_EXPENSE_TOTAL_MISMATCH");
  }
  if (usdToCents(totals.cobros) - egresos !== usdToCents(totals.resultadoNeto)) {
    throw new Error("RFN_NET_TOTAL_MISMATCH");
  }
}
