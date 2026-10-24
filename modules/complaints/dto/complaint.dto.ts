export interface CreateComplaintDTO {
  customer_name?: string;
  customer_phone?: string;
  category: string;
  details: string;
  branch_id?: number;
}

export interface ResolveComplaintDTO {
  resolution_notes: string;
}
