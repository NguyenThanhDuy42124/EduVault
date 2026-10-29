/**
 * Domain TypeScript types for EduVault Frontend
 * Strictly aligned with FastAPI Pydantic schemas and database models
 */

// --- User & Auth ---
export type UserRole = 'ADMIN' | 'BORROWER';

export interface User {
  id: number;
  student_staff_id: string;
  full_name: string;
  email: string;
  role: UserRole;
  wallet_address?: string | null;
  is_active: boolean;
  failed_login_count: number;
  locked_until?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  role: UserRole;
  user_id: number;
}

// --- Equipment ---
export type EquipmentStatus = 'AVAILABLE' | 'RESERVED' | 'IN_USE' | 'MAINTENANCE' | 'RETIRED';

export interface Equipment {
  id: number;
  serial_number: string;
  name: string;
  category: string;
  specifications?: string | null;
  status: EquipmentStatus;
  deposit_amount: string | number;
  image_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EquipmentCreateRequest {
  serial_number: string;
  name: string;
  category: string;
  specifications?: string;
  status?: EquipmentStatus;
  deposit_amount: number;
  image_url?: string;
}

export interface EquipmentUpdateRequest {
  name?: string;
  category?: string;
  specifications?: string;
  status?: EquipmentStatus;
  deposit_amount?: number;
  image_url?: string;
}

// --- Loans ---
export type LoanStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'ACTIVE'
  | 'RETURNED'
  | 'CANCELLED'
  | 'DISPUTED';

export type DepositStatus = 'PENDING' | 'LOCKED' | 'REFUNDED' | 'FORFEITED';
export type ReturnCondition = 'GOOD' | 'DAMAGED' | 'LOST';

export interface Loan {
  id: number;
  user_id: number;
  equipment_id: number;
  request_date: string;
  expected_handover_date: string;
  due_date: string;
  actual_handover_date?: string | null;
  actual_return_date?: string | null;
  status: LoanStatus;
  return_condition?: ReturnCondition | null;
  deposit_amount: string | number;
  deposit_status: DepositStatus;
  on_chain_loan_id?: string | null;
  admin_notes?: string | null;
  is_overdue: boolean;
  created_at: string;
  updated_at: string;
  user?: User | null;
  equipment?: Equipment | null;
}

export interface LoanCreateRequest {
  equipment_id: number;
  expected_handover_date: string;
  due_date: string;
  admin_notes?: string;
}

export interface LoanReturnRequest {
  return_condition: ReturnCondition;
  manual_penalty_percent?: number | null;
  admin_notes?: string;
}

export interface LoanCancelRequest {
  reason?: string;
}

// --- Audit & Blockchain ---
export type TxActionType =
  | 'CREATE_LOAN'
  | 'APPROVE_LOAN'
  | 'REJECT_LOAN'
  | 'HANDOVER'
  | 'RETURN_LOAN'
  | 'CANCEL_LOAN';

export type TxStatus = 'PENDING' | 'CONFIRMED' | 'FAILED';

export interface BlockchainTx {
  id: number;
  request_id?: number | null;
  tx_hash: string;
  action_type: TxActionType;
  from_address: string;
  to_address: string;
  block_number?: number | null;
  gas_used?: number | null;
  status: TxStatus;
  error_message?: string | null;
  created_at: string;
}

export interface AuditLog {
  id: number;
  user_id?: number | null;
  action: string;
  entity_name: string;
  entity_id: number;
  details_json?: Record<string, unknown> | null;
  created_at: string;
}

export interface LoanVerification {
  loan_id: number;
  on_chain_loan_id?: string | null;
  is_synced: boolean;
  mismatches: string[];
  mysql_state: Record<string, unknown>;
  blockchain_state: Record<string, unknown>;
}

export interface ReconcileResult {
  scanned_count: number;
  fixed_count: number;
  details: string[];
}

export interface BlockchainStatus {
  is_connected: boolean;
  network: string;
  chain_id?: number;
  latest_block?: number;
  gas_price_gwei?: number;
  relayer_address?: string;
  relayer_balance_eth?: string;
}

export interface ContractInfo {
  contract_address: string;
  owner_address: string;
  name: string;
  version: string;
}

// --- System & Database Health ---
export interface SystemHealth {
  status: string;
  service: string;
  environment: string;
  version: string;
}

export interface DatabaseHealth {
  status: 'connected' | 'disconnected';
  host: string;
  port: number;
  database: string;
  error?: string;
}
