export interface DeliveryItemDTO {
  id?: number;
  ingredientId?: number;
  itemCode: string;
  itemName: string;
  unit: string;
  qtyRequired: number;
  qtyDelivered: number;
  price: number;
  discountPercent?: number;
  total: number;
}

export interface CreateDeliveryDTO {
  deliveryNo?: string;
  orderId?: number;
  orderNo?: string;
  customerName: string;
  customerId?: number;
  date: string;
  driver?: string;
  carNumber?: string;
  salesRep?: string;
  transportation?: string;
  deliveryMethod?: string;
  warehouse?: string;
  warehouseId?: number;
  notes?: string;
  status?: string;
  items: DeliveryItemDTO[];
}

export interface UpdateDeliveryDTO extends Partial<CreateDeliveryDTO> {
  status?: string;
}
