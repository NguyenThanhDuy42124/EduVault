// contractConfig.ts
// Cấu hình Smart Contract — hỗ trợ cả Hardhat Local và Ethereum Sepolia Testnet

import contractAddress from "./contract_address.json";
import contractAbi from "./EquipmentLending.json";

export const CONTRACT_ADDRESS: string =
  (contractAddress as any).EquipmentLending || (contractAddress as any).address;

export const CONTRACT_ABI = (contractAbi as any).abi;

// === Hardhat Local (Phát triển) ===
export const HARDHAT_CHAIN_ID = 31337;
export const HARDHAT_RPC_URL = "http://127.0.0.1:8545";

// === Ethereum Sepolia Testnet (Triển khai công khai) ===
export const SEPOLIA_CHAIN_ID = 11155111;
export const SEPOLIA_RPC_URL = "https://rpc.sepolia.org";
export const SEPOLIA_ETHERSCAN_URL = "https://sepolia.etherscan.io";

// Mạng mục tiêu hiện tại — đọc từ biến môi trường Vite (VITE_TARGET_NETWORK=sepolia hoặc local)
// Mặc định: "sepolia" nếu không set
const TARGET_NETWORK = (import.meta as any).env?.VITE_TARGET_NETWORK || "sepolia";

export const IS_SEPOLIA = TARGET_NETWORK === "sepolia";

// Chain ID và RPC URL theo mạng mục tiêu
export const TARGET_CHAIN_ID = IS_SEPOLIA ? SEPOLIA_CHAIN_ID : HARDHAT_CHAIN_ID;
export const TARGET_RPC_URL = IS_SEPOLIA ? SEPOLIA_RPC_URL : HARDHAT_RPC_URL;
export const TARGET_CHAIN_NAME = IS_SEPOLIA ? "Ethereum Sepolia Testnet" : "Hardhat Local EVM";

// Hàm tạo link Etherscan (Sepolia) hoặc local explorer
export const getExplorerTxUrl = (txHash: string): string => {
  if (IS_SEPOLIA) return `${SEPOLIA_ETHERSCAN_URL}/tx/${txHash}`;
  return `#`; // Local không có explorer công khai
};

export const getExplorerAddressUrl = (address: string): string => {
  if (IS_SEPOLIA) return `${SEPOLIA_ETHERSCAN_URL}/address/${address}`;
  return `#`;
};
