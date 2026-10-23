export interface SystemHealth {
  status: string;
  service: string;
  environment: string;
  version: string;
}

export interface DatabaseHealth {
  status: 'connected' | 'disconnected';
  host: string;
  port: number;
  database: string;
  error?: string;
}

export interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  message?: string;
  status?: string;
  service?: string;
  environment?: string;
  version?: string;
  database?: DatabaseHealth;
}
