import { CreateAccountDTO, CreateJournalEntryDTO } from "../dto/account.dto.js";

export function validateCreateAccount(data: any): { error?: string; value?: CreateAccountDTO } {
  if (!data.name || typeof data.name !== "string") {
    return { error: "Account name is required and must be a string" };
  }
  if (!data.code || typeof data.code !== "string") {
    return { error: "Account code is required and must be a string" };
  }
  if (!["asset", "liability", "equity", "revenue", "expense"].includes(data.type)) {
    return { error: "Invalid account type" };
  }
  return { value: data as CreateAccountDTO };
}

export function validateCreateJournalEntry(data: any): { error?: string; value?: CreateJournalEntryDTO } {
  if (!Array.isArray(data.items) || data.items.length === 0) {
    return { error: "Journal entry must contain at least one item detail" };
  }
  
  let totalDebit = 0;
  let totalCredit = 0;
  
  for (const item of data.items) {
    if (!item.account_id || typeof item.account_id !== "number") {
      return { error: "Each entry item must have a valid account_id" };
    }
    totalDebit += Number(item.debit || 0);
    totalCredit += Number(item.credit || 0);
  }
  
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return { error: `Journal entry is out of balance. Debits (${totalDebit}) must equal Credits (${totalCredit})` };
  }

  return { value: data as CreateJournalEntryDTO };
}
