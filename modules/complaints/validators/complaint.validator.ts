import { CreateComplaintDTO, ResolveComplaintDTO } from "../dto/complaint.dto.js";

export function validateCreateComplaint(data: any): { error?: string; value?: CreateComplaintDTO } {
  if (!data.category || typeof data.category !== "string") {
    return { error: "Category is required and must be a string" };
  }
  if (!data.details || typeof data.details !== "string") {
    return { error: "Complaint details must be specified" };
  }
  return { value: data as CreateComplaintDTO };
}

export function validateResolveComplaint(data: any): { error?: string; value?: ResolveComplaintDTO } {
  if (!data.resolution_notes || typeof data.resolution_notes !== "string") {
    return { error: "Resolution notes must be provided" };
  }
  return { value: data as ResolveComplaintDTO };
}
