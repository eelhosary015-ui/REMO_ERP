import { CreateSupplierDTO, UpdateSupplierDTO, SupplierPaymentDTO } from "../dto/supplier.dto.js";

const VALID_PAYMENT_TERMS = ['cash', 'credit_30', 'credit_60', 'credit_90'];
const VALID_STATUSES = ['active', 'inactive'];

export function validateCreateSupplier(data: any): { error?: string; value?: CreateSupplierDTO } {
  if (!data.name || typeof data.name !== "string" || data.name.trim().length === 0) {
    return { error: "Supplier name is required" };
  }

  if (data.phone && typeof data.phone !== "string") {
    return { error: "Phone must be a string" };
  }

  if (data.phone_2 && typeof data.phone_2 !== "string") {
    return { error: "Phone 2 must be a string" };
  }

  if (data.email && typeof data.email === "string") {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      return { error: "Invalid email format" };
    }
  }

  if (data.payment_terms && !VALID_PAYMENT_TERMS.includes(data.payment_terms)) {
    return { error: "Payment terms must be one of: cash, credit_30, credit_60, credit_90" };
  }

  if (data.credit_limit !== undefined && (typeof data.credit_limit !== "number" || data.credit_limit < 0)) {
    return { error: "Credit limit must be a non-negative number" };
  }

  if (data.opening_balance !== undefined && (typeof data.opening_balance !== "number" || data.opening_balance < 0)) {
    return { error: "Opening balance must be a non-negative number" };
  }

  if (data.status && !VALID_STATUSES.includes(data.status)) {
    return { error: "Status must be 'active' or 'inactive'" };
  }

  return { value: data as CreateSupplierDTO };
}

export function validateUpdateSupplier(data: any): { error?: string; value?: UpdateSupplierDTO } {
  if (data.name !== undefined && (typeof data.name !== "string" || data.name.trim().length === 0)) {
    return { error: "Supplier name must be a non-empty string" };
  }

  if (data.phone !== undefined && typeof data.phone !== "string") {
    return { error: "Phone must be a string" };
  }

  if (data.phone_2 !== undefined && typeof data.phone_2 !== "string") {
    return { error: "Phone 2 must be a string" };
  }

  if (data.email !== undefined && data.email !== null && typeof data.email === "string" && data.email.length > 0) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      return { error: "Invalid email format" };
    }
  }

  if (data.payment_terms !== undefined && !VALID_PAYMENT_TERMS.includes(data.payment_terms)) {
    return { error: "Payment terms must be one of: cash, credit_30, credit_60, credit_90" };
  }

  if (data.credit_limit !== undefined && (typeof data.credit_limit !== "number" || data.credit_limit < 0)) {
    return { error: "Credit limit must be a non-negative number" };
  }

  if (data.status !== undefined && !VALID_STATUSES.includes(data.status)) {
    return { error: "Status must be 'active' or 'inactive'" };
  }

  return { value: data as UpdateSupplierDTO };
}

export function validateSupplierPayment(data: any): { error?: string; value?: SupplierPaymentDTO } {
  if (!data.amount || typeof data.amount !== "number" || data.amount <= 0) {
    return { error: "Payment amount must be a positive number" };
  }

  if (data.payment_method && typeof data.payment_method !== "string") {
    return { error: "Payment method must be a string" };
  }

  if (data.safe_id !== undefined && (typeof data.safe_id !== "number" || data.safe_id <= 0)) {
    return { error: "Safe ID must be a positive number" };
  }

  return { value: data as SupplierPaymentDTO };
}