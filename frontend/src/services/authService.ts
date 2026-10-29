import api from './api';
import { TokenResponse, User } from '../types';

export const authService = {
  login: async (identifier: string, password: string): Promise<TokenResponse> => {
    const res = await api.post<TokenResponse>('/auth/login', {
      identifier: identifier.trim(),
      password,
    });
    return res.data;
  },

  getMe: async (): Promise<User> => {
    const res = await api.get<User>('/users/me');
    return res.data;
  },

  getUsers: async (): Promise<User[]> => {
    const res = await api.get<User[]>('/admin/users');
    return res.data;
  },

  createUser: async (payload: {
    student_staff_id: string;
    full_name: string;
    email: string;
    password: string;
    role: 'ADMIN' | 'BORROWER';
  }): Promise<User> => {
    const res = await api.post<User>('/admin/users', payload);
    return res.data;
  },
};
