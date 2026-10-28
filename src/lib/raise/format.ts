export function orderedCheque(
  min: number | null,
  max: number | null,
): {
  low: number | null;
  high: number | null;
} {
  if (min != null && max != null && max < min) return { low: max, high: min };
  return { low: min, high: max };
}

export function formatMoney(amount: number | null, currency: string): string {
  if (amount == null) return "Unknown";
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en-GB")}`;
  }
}

export function formatCheque(investor: {
  chequeMin: number | null;
  chequeMax: number | null;
  chequeCurrency: string;
}): string {
  const { low: chequeMin, high: chequeMax } = orderedCheque(investor.chequeMin, investor.chequeMax);
  const currency = investor.chequeCurrency;
  if (chequeMin == null && chequeMax == null) return "Ticket not stated";
  if (chequeMin != null && chequeMax != null) {
    return `${formatMoney(chequeMin, currency)}–${formatMoney(chequeMax, currency)} stated`;
  }
  const only = chequeMin ?? chequeMax;
  return `${formatMoney(only, currency)} stated`;
}

export function stripHtml(value: string | null): string {
  if (!value) return "";
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function investorKind(investorType: string): string {
  if (investorType === "venture_capital") return "VC";
  if (investorType === "angel_fund") return "Angel fund";
  if (investorType === "angel") return "Angel";
  return investorType;
}
