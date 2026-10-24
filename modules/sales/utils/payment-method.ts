export function isCreditPaymentMethod(paymentMethod: unknown): boolean {
  const normalized = String(paymentMethod || "")
    .trim()
    .toLowerCase()
    .replace(/[أإآٱ]/g, "ا");
  return normalized.includes("اجل") || normalized.includes("credit");
}
