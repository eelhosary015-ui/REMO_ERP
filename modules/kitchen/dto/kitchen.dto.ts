export interface UpdateKitchenItemStatusDTO {
  order_id: number;
  item_id: number;
  status: "pending" | "preparing" | "ready" | "served";
}
