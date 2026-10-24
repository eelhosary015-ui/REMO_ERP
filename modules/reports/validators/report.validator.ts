import { FetchReportDTO } from "../dto/report.dto.js";

export function validateFetchReport(data: any): { error?: string; value?: FetchReportDTO } {
  if (!data.start_date || !data.end_date) {
    return { error: "Both start_date and end_date are required to query reporting modules" };
  }
  return { value: data as FetchReportDTO };
}
