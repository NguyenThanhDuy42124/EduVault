// contractConfig.ts
// Cấu hình Smart Contract — hỗ trợ cả Hardhat Local và Ethereum Sepolia Testnet

import contractAddress from "./contract_address.json";
import contractAbi from "./EquipmentLending.json";

export const CONTRACT_ABI = (contractAbi as any).abi;

// === Hardhat Local (Phát triển) ===
export const HARDHAT_CHAIN_ID = 31337;
export const HARDHAT_RPC_URL = "http://127.0.0.1:8545";
export const HARDHAT_DEFAULT_CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

// === Ethereum Sepolia Testnet (Triển khai công khai) ===
export const SEPOLIA_CHAIN_ID = 11155111;
export const SEPOLIA_RPC_URL = "https://rpc.sepolia.org";
export const SEPOLIA_ETHERSCAN_URL = "https://sepolia.etherscan.io";

const viteEnv = (import.meta as any).env || {};
const TARGET_NETWORK = viteEnv.VITE_TARGET_NETWORK || "sepolia";

export const IS_SEPOLIA = TARGET_NETWORK === "sepolia";

// Chain ID và RPC URL theo mạng mục tiêu
export const TARGET_CHAIN_ID = viteEnv.VITE_CHAIN_ID
  ? Number(viteEnv.VITE_CHAIN_ID)
  : IS_SEPOLIA
  ? SEPOLIA_CHAIN_ID
  : HARDHAT_CHAIN_ID;
export const TARGET_RPC_URL = viteEnv.VITE_RPC_URL || (IS_SEPOLIA ? SEPOLIA_RPC_URL : HARDHAT_RPC_URL);
export const TARGET_CHAIN_NAME = IS_SEPOLIA ? "Ethereum Sepolia Testnet" : "Hardhat Local EVM";

const artifactAddress: string =
  (contractAddress as any).EquipmentLending || (contractAddress as any).address || "";
const artifactChainId: number | null = (contractAddress as any).chainId
  ? Number((contractAddress as any).chainId)
  : null;
const envContractAddress: string | undefined = viteEnv.VITE_CONTRACT_ADDRESS;

// Chỉ dùng địa chỉ trong contract_address.json nếu chainId khớp với mạng mục tiêu (hoặc khi có VITE_CONTRACT_ADDRESS)
export const CONTRACT_ADDRESS: string = envContractAddress
  ? envContractAddress.trim()
  : artifactChainId === TARGET_CHAIN_ID && artifactAddress
  ? artifactAddress
  : !IS_SEPOLIA
  ? HARDHAT_DEFAULT_CONTRACT_ADDRESS
  : "";

export const CONTRACT_ARTIFACT_CHAIN_ID = artifactChainId;
export const IS_CONTRACT_CONFIG_MATCHED = Boolean(CONTRACT_ADDRESS);

// Hàm tạo link Etherscan (Sepolia) hoặc local explorer
export const getExplorerTxUrl = (txHash: string): string => {
  if (IS_SEPOLIA) return `${SEPOLIA_ETHERSCAN_URL}/tx/${txHash}`;
  return `#`; // Local không có explorer công khai
};

export const getExplorerAddressUrl = (address: string): string => {
  if (IS_SEPOLIA) return `${SEPOLIA_ETHERSCAN_URL}/address/${address}`;
  return `#`;
};
