export interface QuotationItemDTO {
  id?: number;
  itemId?: number;
  itemType?: string;
  barcode?: string;
  code?: string;
  name: string;
  unit?: string;
  qty: number;
  price: number;
  discountPercent?: number;
  vatPercent?: number;
}

export interface CreateQuotationDTO {
  quotationNo?: string;
  customerName: string;
  date: string;
  validityDate?: string;
  salesRep?: string;
  warehouse?: string;
  branch?: string;
  currency?: string;
  paymentMethod?: string;
  notes?: string;
  status?: string;
  totalItems?: number;
  totalDiscount?: number;
  totalTax?: number;
  netAmount?: number;
  items: QuotationItemDTO[];
}

export interface UpdateQuotationDTO extends CreateQuotationDTO {}
