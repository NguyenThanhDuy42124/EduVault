import api from './api';
import { Loan, LoanCreateRequest, LoanReturnRequest, LoanCancelRequest } from '../types';

export const loanService = {
  requestLoan: async (data: LoanCreateRequest): Promise<Loan> => {
    const res = await api.post<Loan>('/loans/request', data);
    return res.data;
  },

  getMyLoans: async (): Promise<Loan[]> => {
    const res = await api.get<Loan[]>('/loans/my-loans');
    return res.data;
  },

  getAllLoans: async (params?: {
    status?: string;
    skip?: number;
    limit?: number;
  }): Promise<Loan[]> => {
    const res = await api.get<Loan[]>('/loans', { params });
    return res.data;
  },

  getLoanById: async (id: number): Promise<Loan> => {
    const res = await api.get<Loan>(`/loans/${id}`);
    return res.data;
  },

  approveLoan: async (id: number): Promise<Loan> => {
    const res = await api.post<Loan>(`/loans/${id}/approve`);
    return res.data;
  },

  rejectLoan: async (id: number, adminNotes?: string): Promise<Loan> => {
    const res = await api.post<Loan>(`/loans/${id}/reject`, null, {
      params: adminNotes ? { admin_notes: adminNotes } : undefined,
    });
    return res.data;
  },

  handoverLoan: async (id: number): Promise<Loan> => {
    const res = await api.post<Loan>(`/loans/${id}/handover`);
    return res.data;
  },

  returnLoan: async (id: number, data: LoanReturnRequest): Promise<Loan> => {
    const res = await api.post<Loan>(`/loans/${id}/return`, data);
    return res.data;
  },

  cancelLoan: async (id: number, data: LoanCancelRequest): Promise<Loan> => {
    const res = await api.post<Loan>(`/loans/${id}/cancel`, data);
    return res.data;
  },
};
