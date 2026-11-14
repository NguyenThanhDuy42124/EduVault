import api from './api';
import { TokenResponse, User, WalletChallengeResponse } from '../types';

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

  requestWalletChallenge: async (walletAddress: string): Promise<WalletChallengeResponse> => {
    const res = await api.post<WalletChallengeResponse>('/users/wallet/challenge', {
      wallet_address: walletAddress,
    });
    return res.data;
  },

  verifyWalletSignature: async (walletAddress: string, signature: string): Promise<User> => {
    const res = await api.post<User>('/users/wallet/verify', {
      wallet_address: walletAddress,
      signature,
    });
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
