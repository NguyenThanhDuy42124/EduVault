import axios from 'axios';
import { SystemHealth, DatabaseHealth } from '../types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

export const healthService = {
  checkSystemHealth: async (): Promise<SystemHealth> => {
    const res = await api.get<SystemHealth>('/health');
    return res.data;
  },
  checkDbHealth: async (): Promise<{ database: DatabaseHealth }> => {
    const res = await api.get<{ database: DatabaseHealth }>('/health/db');
    return res.data;
  },
};

export default api;
