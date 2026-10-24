type TreasuryVoucherType = "receipt" | "payment" | "transfer";

export async function generateTreasuryVoucherNumber(
  client: { query: (sql: string, values?: unknown[]) => Promise<{ rows: Array<{ sequence: number }> }> },
  voucherType: TreasuryVoucherType | string,
  year = new Date().getFullYear(),
): Promise<string> {
  const normalizedType = String(voucherType).trim().toLowerCase() as TreasuryVoucherType;

  await client.query(
    "SELECT pg_advisory_xact_lock(hashtext($1), $2)",
    [`treasury-voucher-${normalizedType}`, year],
  );

  const prefix = normalizedType === "receipt" ? "REC" : normalizedType === "payment" ? "PAY" : "TRF";
  const typeColumn = normalizedType === "transfer" ? "transaction_type" : "voucher_type";
  const sequenceRes = await client.query(
    `SELECT COALESCE(MAX((regexp_match(voucher_number, $1))[1]::integer), 0)::integer AS sequence
       FROM treasury_transactions
      WHERE ${typeColumn} = $2
        AND EXTRACT(YEAR FROM created_at) = $3
        AND voucher_number ~ $1`,
    [`^${prefix}-${year}-([0-9]+)$`, normalizedType, year],
  );
  const nextSequence = Number(sequenceRes.rows[0]?.sequence || 0) + 1;

  return `${prefix}-${year}-${nextSequence.toString().padStart(4, "0")}`;
}
