export interface CreateAccountDTO {
  name: string;
  code: string;
  type: "asset" | "liability" | "equity" | "revenue" | "expense";
  parent_id?: number;
}

export interface CreateJournalEntryItemDTO {
  account_id: number;
  debit: number;
  credit: number;
  notes?: string;
  cost_center_id?: number;
}

export interface CreateJournalEntryDTO {
  reference_number?: string;
  notes?: string;
  date?: string;
  items: CreateJournalEntryItemDTO[];
}
