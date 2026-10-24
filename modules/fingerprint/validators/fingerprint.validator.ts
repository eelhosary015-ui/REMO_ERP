import { RegisterDeviceDTO } from "../dto/fingerprint.dto.js";

export function validateRegisterDevice(data: any): { error?: string; value?: RegisterDeviceDTO } {
  if (!data.name || typeof data.name !== "string") {
    return { error: "Device name is required and must be a string" };
  }
  if (!data.ip_address || typeof data.ip_address !== "string") {
    return { error: "IP address is required and must be a valid IP string" };
  }
  if (typeof data.port !== "number" || data.port <= 0) {
    return { error: "Port must be a positive number" };
  }
  return { value: data as RegisterDeviceDTO };
}
