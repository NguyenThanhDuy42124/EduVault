import api from './api';
import { User } from '../types';

export interface PendingBorrower {
  id: number;
  student_staff_id: string;
  full_name: string;
  email: string;
  wallet_address: string;
  wallet_verified: boolean;
  has_on_chain_borrower_role: boolean;
}

export const adminRoleService = {
  getPendingBorrowers: async (): Promise<PendingBorrower[]> => {
    const res = await api.get<PendingBorrower[]>('/admin/pending-borrowers');
    return res.data;
  },

  getAllUsers: async (): Promise<User[]> => {
    const res = await api.get<User[]>('/admin/users');
    return res.data;
  },
};
