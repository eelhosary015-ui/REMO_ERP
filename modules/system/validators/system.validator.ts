import { UpdateSettingDTO } from "../dto/system.dto.js";

export function validateUpdateSetting(data: any): { error?: string; value?: UpdateSettingDTO } {
  if (!data.key || typeof data.key !== "string" || data.key.trim() === "") {
    return { error: "Setting key must be a valid non-empty string" };
  }
  if (data.value === undefined || typeof data.value !== "string") {
    return { error: "Setting value must be a valid string string" };
  }
  return { value: data as UpdateSettingDTO };
}
