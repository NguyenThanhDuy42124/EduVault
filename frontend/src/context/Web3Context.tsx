import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  switchNetwork: () => Promise<void>;
  getSigner: () => Promise<ethers.Signer | null>;
  getContract: (withSigner?: boolean) => Promise<ethers.Contract | null>;
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined);

declare global {
  interface Window {
    ethereum?: any;
  }
}

export const Web3Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [balanceEth, setBalanceEth] = useState<string | null>(null);

  const isConnected = !!account;
  const isCorrectNetwork = chainId === TARGET_CHAIN_ID;

  // Lấy số dư ETH
  const updateBalance = useCallback(async (addr: string) => {
    try {
      if (window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const bal = await provider.getBalance(addr);
        setBalanceEth(parseFloat(ethers.formatEther(bal)).toFixed(4));
      }
    } catch (e) {
      console.error('Error fetching balance:', e);
    }
  }, []);

  // Chuyển sang mạng mục tiêu (Sepolia hoặc Hardhat local)
  const switchNetwork = async () => {
    if (!window.ethereum) return;
    const hexChainId = '0x' + TARGET_CHAIN_ID.toString(16);
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: hexChainId }],
      });
    } catch (switchError: any) {
      // Mã 4902: Mạng chưa được add vào MetaMask -> Thêm mạng mới
      if (switchError.code === 4902 || switchError?.data?.originalError?.code === 4902) {
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
      } else {
        throw switchError;
      }
    }
  };

  // Kết nối MetaMask
  const connectWallet = async () => {
    if (!window.ethereum) {
      alert('Không tìm thấy MetaMask! Vui lòng cài đặt tiện ích mở rộng MetaMask để tiếp tục.');
      return;
    }

    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        const provider = new ethers.BrowserProvider(window.ethereum);
        const network = await provider.getNetwork();
        const curChain = Number(network.chainId);
        setChainId(curChain);
        await updateBalance(accounts[0]);

        // Nếu không đúng mạng mục tiêu thì gợi ý chuyển
        if (curChain !== TARGET_CHAIN_ID) {
          await switchNetwork();
        }
      }
    } catch (err: any) {
      console.error('Lỗi kết nối ví:', err);
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setChainId(null);
    setBalanceEth(null);
  };

  // Lấy Signer để ký giao dịch
  const getSigner = async (): Promise<ethers.Signer | null> => {
    if (!window.ethereum) return null;
    const provider = new ethers.BrowserProvider(window.ethereum);
    return await provider.getSigner();
  };

  // Lấy Contract instance
  const getContract = async (withSigner = false): Promise<ethers.Contract | null> => {
    if (!window.ethereum) return null;
    const provider = new ethers.BrowserProvider(window.ethereum);
    if (withSigner) {
      const signer = await provider.getSigner();
      return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    }
    return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
  };

  // Lắng nghe sự kiện đổi tài khoản / đổi mạng từ MetaMask
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        updateBalance(accounts[0]);
      } else {
        disconnectWallet();
      }
    };

    const handleChainChanged = (chainHex: string) => {
      const id = parseInt(chainHex, 16);
      setChainId(id);
      if (account) updateBalance(account);
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    // Cleanup listeners khi component unmount (tránh memory leak)
    return () => {
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum?.removeListener('chainChanged', handleChainChanged);
    };
  }, [account, updateBalance]);

  return (
    <Web3Context.Provider
      value={{
        account,
        chainId,
        balanceEth,
        isConnected,
        isCorrectNetwork,
        connectWallet,
        disconnectWallet,
        switchNetwork,
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
