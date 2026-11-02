import contractAddress from "./contract_address.json";
import contractAbi from "./EquipmentLending.json";

export const CONTRACT_ADDRESS: string = (contractAddress as any).EquipmentLending || (contractAddress as any).address;
export const CONTRACT_ABI = contractAbi.abi;
export const HARDHAT_CHAIN_ID = 31337;
export const HARDHAT_RPC_URL = "http://127.0.0.1:8545";
