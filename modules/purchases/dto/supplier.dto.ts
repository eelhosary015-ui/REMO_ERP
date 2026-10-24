export interface CreateSupplierDTO {
  name: string;
  phone?: string;
  phone_2?: string;
  email?: string;
  address?: string;
  commercial_register?: string;
  tax_number?: string;
  group_name?: string;
  payment_terms?: string;  // 'cash', 'credit_30', 'credit_60', 'credit_90'
  credit_limit?: number;
  opening_balance?: number;
  notes?: string;
  status?: string; // 'active', 'inactive'
}

export interface UpdateSupplierDTO extends Partial<CreateSupplierDTO> {}

export interface SupplierPaymentDTO {
  amount: number;
  payment_method?: string;
  notes?: string;
  reference_type?: string;
  safe_id?: number;
}

export interface SupplierTransactionDTO {
  supplier_id: number;
  type: 'purchase' | 'payment' | 'return' | 'adjustment';
  amount: number;
  notes?: string;
  reference_id?: number;
  payment_method?: string;
  reference_type?: string;
  currency?: string;
  due_date?: string;
  document_number?: string;
}