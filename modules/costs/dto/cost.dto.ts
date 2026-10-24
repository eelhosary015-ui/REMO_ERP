export interface CreateCostDTO {
  category: string;
  amount: number;
  branch_id?: number;
  notes?: string;
  date?: string;
}
