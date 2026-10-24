export interface RegisterDeviceDTO {
  name: string;
  ip_address: string;
  port: number;
  branch_id?: number;
  device_type?: 'zkteco' | 'hikvision';
  protocol?: 'tcp' | 'http' | 'https';
  username?: string;
  password?: string;
}
