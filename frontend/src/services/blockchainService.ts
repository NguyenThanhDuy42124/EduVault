import api from './api';
import { BlockchainStatus, ContractInfo } from '../types';

export const blockchainService = {
  getStatus: async (): Promise<BlockchainStatus> => {
    const res = await api.get<BlockchainStatus>('/blockchain/status');
    return res.data;
  },

  getContractInfo: async (): Promise<ContractInfo> => {
    const res = await api.get<ContractInfo>('/blockchain/contract-info');
    return res.data;
  },
};
