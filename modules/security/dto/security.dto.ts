export interface UpdateUserPermissionsDTO {
  user_id: number;
  permissions: string[];
}

export interface SecurityStatusDTO {
  lock_status: boolean;
  active_sessions_count: number;
}
