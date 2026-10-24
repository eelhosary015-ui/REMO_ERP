export interface UpdateSettingDTO {
  key: string;
  value: string;
}

export interface SystemStatusDTO {
  uptime: number;
  db_connection: "online" | "offline";
  cpu_usage?: number;
  memory_usage: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
  };
}
