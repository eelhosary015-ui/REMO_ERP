export interface CreateSafeDTO {
  name: string;
  branch_id?: number | null;
  balance?: number;
}

export interface AdjustBalanceDTO {
  amount: number;
  type: "in" | "out" | "transfer" | "deficit" | "surplus" | "cash_drop";
  notes?: string;
  user_id?: number;
  target_safe_id?: number;
}
