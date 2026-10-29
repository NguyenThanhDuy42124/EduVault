import api from './api';
import { BlockchainTx, AuditLog, LoanVerification, ReconcileResult } from '../types';

export const auditService = {
  getTransactions: async (limit = 50): Promise<BlockchainTx[]> => {
    const res = await api.get<BlockchainTx[]>('/audit/transactions', {
      params: { limit },
    });
    return res.data;
  },

  verifyLoan: async (loanId: number): Promise<LoanVerification> => {
    const res = await api.get<LoanVerification>(`/audit/loans/${loanId}/verify`);
    return res.data;
  },

  runReconcile: async (): Promise<ReconcileResult> => {
    const res = await api.post<ReconcileResult>('/audit/reconcile');
    return res.data;
  },

  getAuditLogs: async (limit = 50): Promise<AuditLog[]> => {
    const res = await api.get<AuditLog[]>('/audit/logs', {
      params: { limit },
    });
    return res.data;
  },
};
