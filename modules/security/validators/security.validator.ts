import { UpdateUserPermissionsDTO } from "../dto/security.dto.js";

export function validateUpdatePermissions(data: any): { error?: string; value?: UpdateUserPermissionsDTO } {
  if (!data.user_id || typeof data.user_id !== "number") {
    return { error: "User ID is required and must be a number" };
  }
  if (!Array.isArray(data.permissions)) {
    return { error: "Permissions must be an array of strings" };
  }
  return { value: data as UpdateUserPermissionsDTO };
}
