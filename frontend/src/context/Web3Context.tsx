import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import {
  CONTRACT_ADDRESS,
  CONTRACT_ABI,
  TARGET_CHAIN_ID,
  TARGET_CHAIN_NAME,
  TARGET_RPC_URL,
  IS_SEPOLIA,
} from '../contracts/contractConfig';

interface Web3ContextType {
  account: string | null;
  chainId: number | null;
  balanceEth: string | null;
  isConnected: boolean;
  isCorrectNetwork: boolean;
  web3Error: string | null;
  clearWeb3Error: () => void;
  parseWeb3Error: (err: unknown) => string;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  switchNetwork: () => Promise<void>;
  signMessage: (message: string) => Promise<string>;
  verifyDeployedContract: () => Promise<{ ok: boolean; error?: string }>;
  getSigner: () => Promise<ethers.Signer | null>;
  getContract: (withSigner?: boolean) => Promise<ethers.Contract | null>;
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined);

declare global {
  interface Window {
    ethereum?: any;
  }
}

export const parseWeb3ErrorMessage = (err: unknown): string => {
  const e = err as {
    code?: number | string;
    info?: { error?: { code?: number; message?: string } };
    reason?: string;
    shortMessage?: string;
    message?: string;
    data?: { message?: string };
  };

  const rawCode = e?.code ?? e?.info?.error?.code;
  const rawMsg = `${e?.shortMessage || ''} ${e?.reason || ''} ${e?.message || ''} ${e?.data?.message || ''}`.toLowerCase();

  if (rawCode === 4001 || rawCode === 'ACTION_REJECTED' || rawMsg.includes('user rejected')) {
    return 'Bạn đã từ chối thao tác ký hoặc kết nối trên ví MetaMask.';
  }
  if (rawCode === -32002 || rawMsg.includes('already processing')) {
    return 'MetaMask đang có một yêu cầu chờ xác nhận. Vui lòng mở popup MetaMask để hoàn tất.';
  }
  if (rawCode === 'INSUFFICIENT_FUNDS' || rawMsg.includes('insufficient funds')) {
    return 'Số dư ETH trong ví không đủ để thanh toán phí gas giao dịch.';
  }
  if (
    rawCode === 'NETWORK_ERROR' ||
    rawMsg.includes('failed to fetch') ||
    rawMsg.includes('econnrefused') ||
    rawMsg.includes('could not coalesce error')
  ) {
    return `Không thể kết nối tới RPC mạng ${TARGET_CHAIN_NAME}. Vui lòng kiểm tra node hoặc thử lại.`;
  }
  if (e?.reason) {
    return `Hợp đồng thông minh từ chối: ${e.reason}`;
  }
  if (e?.shortMessage) {
    return e.shortMessage;
  }
  if (e?.message && e.message.length < 180) {
    return e.message;
  }
  return 'Thao tác Web3 trên MetaMask không thành công. Vui lòng thử lại.';
};

export const Web3Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [balanceEth, setBalanceEth] = useState<string | null>(null);
  const [web3Error, setWeb3Error] = useState<string | null>(null);

  const accountRef = useRef<string | null>(null);
  accountRef.current = account;

  const isConnected = !!account;
  const isCorrectNetwork = chainId === TARGET_CHAIN_ID;

  const clearWeb3Error = useCallback(() => setWeb3Error(null), []);

  const updateBalance = useCallback(async (addr: string) => {
    try {
      if (window.ethereum && addr) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const bal = await provider.getBalance(addr);
        setBalanceEth(parseFloat(ethers.formatEther(bal)).toFixed(4));
      }
    } catch {
      setBalanceEth(null);
    }
  }, []);

  const switchNetwork = useCallback(async () => {
    if (!window.ethereum) {
      setWeb3Error('Không tìm thấy ví MetaMask.');
      return;
    }
    setWeb3Error(null);
    const hexChainId = '0x' + TARGET_CHAIN_ID.toString(16);
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: hexChainId }],
      });
    } catch (switchError: any) {
      if (switchError?.code === 4902 || switchError?.data?.originalError?.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: hexChainId,
                chainName: TARGET_CHAIN_NAME,
                nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                rpcUrls: [TARGET_RPC_URL],
                ...(IS_SEPOLIA && {
                  blockExplorerUrls: ['https://sepolia.etherscan.io'],
                }),
              },
            ],
          });
        } catch (addErr) {
          setWeb3Error(parseWeb3ErrorMessage(addErr));
          throw addErr;
        }
      } else {
        setWeb3Error(parseWeb3ErrorMessage(switchError));
        throw switchError;
      }
    }
  }, []);

  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      setWeb3Error('Không tìm thấy MetaMask! Vui lòng cài đặt tiện ích mở rộng MetaMask để tiếp tục.');
      return;
    }
    setWeb3Error(null);
    try {
      const accounts: string[] = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts && accounts.length > 0) {
        const checksumAcc = ethers.getAddress(accounts[0]);
        setAccount(checksumAcc);
        const provider = new ethers.BrowserProvider(window.ethereum);
        const network = await provider.getNetwork();
        const curChain = Number(network.chainId);
        setChainId(curChain);
        await updateBalance(checksumAcc);

        if (curChain !== TARGET_CHAIN_ID) {
          await switchNetwork();
        }
      }
    } catch (err: unknown) {
      setWeb3Error(parseWeb3ErrorMessage(err));
    }
  }, [switchNetwork, updateBalance]);

  const disconnectWallet = useCallback(() => {
    setAccount(null);
    setChainId(null);
    setBalanceEth(null);
    setWeb3Error(null);
  }, []);

  const signMessage = useCallback(async (message: string): Promise<string> => {
    if (!window.ethereum) {
      throw new Error('Không tìm thấy tiện ích mở rộng MetaMask.');
    }
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    return await signer.signMessage(message);
  }, []);

  const verifyDeployedContract = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    if (!window.ethereum) {
      return { ok: false, error: 'Chưa cài đặt MetaMask.' };
    }
    if (!CONTRACT_ADDRESS) {
      return { ok: false, error: `Chưa cấu hình địa chỉ Smart Contract cho mạng ${TARGET_CHAIN_NAME}.` };
    }
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();
      const liveChain = Number(network.chainId);
      setChainId(liveChain);
      if (liveChain !== TARGET_CHAIN_ID) {
        return {
          ok: false,
          error: `MetaMask đang ở Chain ID ${liveChain}, vui lòng chuyển sang ${TARGET_CHAIN_NAME} (Chain ID ${TARGET_CHAIN_ID}).`,
        };
      }
      const code = await provider.getCode(CONTRACT_ADDRESS);
      if (!code || code === '0x') {
        return {
          ok: false,
          error: `Chưa tìm thấy Smart Contract tại ${CONTRACT_ADDRESS} trên ${TARGET_CHAIN_NAME}. Vui lòng kiểm tra deploy/RPC.`,
        };
      }
      return { ok: true };
    } catch (err: unknown) {
      return { ok: false, error: parseWeb3ErrorMessage(err) };
    }
  }, []);

  const getSigner = useCallback(async (): Promise<ethers.Signer | null> => {
    if (!window.ethereum) return null;
    const provider = new ethers.BrowserProvider(window.ethereum);
    return await provider.getSigner();
  }, []);

  const getContract = useCallback(async (withSigner = false): Promise<ethers.Contract | null> => {
    if (!window.ethereum || !CONTRACT_ADDRESS) return null;
    const provider = new ethers.BrowserProvider(window.ethereum);
    if (withSigner) {
      const signer = await provider.getSigner();
      return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    }
    return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
  }, []);

  // Hydrate phiên MetaMask hiện có và đăng ký listener một lần duy nhất
  useEffect(() => {
    if (!window.ethereum) return;
    let mounted = true;

    const hydrateSession = async () => {
      try {
        const accounts: string[] = await window.ethereum.request({ method: 'eth_accounts' });
        const hexChain: string = await window.ethereum.request({ method: 'eth_chainId' });
        if (!mounted) return;
        if (hexChain) setChainId(parseInt(hexChain, 16));
        if (accounts && accounts.length > 0) {
          const checksumAcc = ethers.getAddress(accounts[0]);
          setAccount(checksumAcc);
          updateBalance(checksumAcc);
        }
      } catch {
        // Bỏ qua lỗi khởi tạo thụ động
      }
    };

    hydrateSession();

    const handleAccountsChanged = (accounts: string[]) => {
      if (!mounted) return;
      if (accounts && accounts.length > 0) {
        const checksumAcc = ethers.getAddress(accounts[0]);
        setAccount(checksumAcc);
        setWeb3Error(null);
        updateBalance(checksumAcc);
      } else {
        disconnectWallet();
      }
    };

    const handleChainChanged = (chainHex: string) => {
      if (!mounted) return;
      const id = parseInt(chainHex, 16);
      setChainId(id);
      setWeb3Error(null);
      if (accountRef.current) {
        updateBalance(accountRef.current);
      }
    };

    const handleDisconnect = () => {
      if (!mounted) return;
      disconnectWallet();
    };

    window.ethereum.on?.('accountsChanged', handleAccountsChanged);
    window.ethereum.on?.('chainChanged', handleChainChanged);
    window.ethereum.on?.('disconnect', handleDisconnect);

    return () => {
      mounted = false;
      window.ethereum?.removeListener?.('accountsChanged', handleAccountsChanged);
      window.ethereum?.removeListener?.('chainChanged', handleChainChanged);
      window.ethereum?.removeListener?.('disconnect', handleDisconnect);
    };
  }, [disconnectWallet, updateBalance]);

  return (
    <Web3Context.Provider
      value={{
        account,
        chainId,
        balanceEth,
        isConnected,
        isCorrectNetwork,
        web3Error,
        clearWeb3Error,
        parseWeb3Error: parseWeb3ErrorMessage,
        connectWallet,
        disconnectWallet,
        switchNetwork,
        signMessage,
        verifyDeployedContract,
        getSigner,
        getContract,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
};

export const useWeb3 = () => {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error('useWeb3 must be used within a Web3Provider');
  }
  return context;
};
