import { CreateCustomerDTO, RecordCustomerTransactionDTO } from "../dto/customer.dto.js";

export function validateCreateCustomer(data: any): { error?: string; value?: CreateCustomerDTO } {
  if (!data.name || typeof data.name !== "string") {
    return { error: "Customer name is required" };
  }
  if (!data.phone || typeof data.phone !== "string") {
    return { error: "Customer phone is required" };
  }
  return { value: data as CreateCustomerDTO };
}

export function validateRecordCustomerTransaction(data: any): { error?: string; value?: RecordCustomerTransactionDTO } {
  if (!data.customer_id || typeof data.customer_id !== "number") {
    return { error: "Customer ID must be a number" };
  }
  if (typeof data.amount !== "number" || data.amount <= 0) {
    return { error: "Transaction amount must be a positive number" };
  }
  if (!["payment", "charge"].includes(data.type)) {
    return { error: "Transaction type must be either 'payment' or 'charge'" };
  }
  return { value: data as RecordCustomerTransactionDTO };
}
