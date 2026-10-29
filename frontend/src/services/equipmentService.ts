import api from './api';
import { Equipment, EquipmentCreateRequest, EquipmentUpdateRequest } from '../types';

export const equipmentService = {
  getAll: async (params?: {
    category?: string;
    status?: string;
    search?: string;
    skip?: number;
    limit?: number;
  }): Promise<Equipment[]> => {
    const res = await api.get<Equipment[]>('/equipment', { params });
    return res.data;
  },

  getById: async (id: number): Promise<Equipment> => {
    const res = await api.get<Equipment>(`/equipment/${id}`);
    return res.data;
  },

  create: async (data: EquipmentCreateRequest): Promise<Equipment> => {
    const res = await api.post<Equipment>('/equipment', data);
    return res.data;
  },

  update: async (id: number, data: EquipmentUpdateRequest): Promise<Equipment> => {
    const res = await api.put<Equipment>(`/equipment/${id}`, data);
    return res.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/equipment/${id}`);
  },
};
