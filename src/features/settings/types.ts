// Module M3.2 — Admin & System Settings: types.
export interface SystemSetting {
  key: string;
  value: unknown;
  category: string | null;
  description: string | null;
}

export interface AdapterRow {
  kind: "comm" | "storage" | "hrms";
  provider: string;
  is_enabled: boolean;
  config_status: string;
}
