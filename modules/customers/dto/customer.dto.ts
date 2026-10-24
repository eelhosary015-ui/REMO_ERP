export interface CreateCustomerDTO {
  name: string;
  phone: string;
  email?: string;
  address?: string;
}

export interface RecordCustomerTransactionDTO {
  customer_id: number;
  amount: number;
  type: "payment" | "charge";
  notes?: string;
}
