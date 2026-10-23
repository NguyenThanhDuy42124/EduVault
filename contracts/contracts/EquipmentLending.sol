// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title EquipmentLending
 * @notice Smart contract for educational equipment lending lifecycle & audit trail.
 * @dev Implements Simulated Deposit Accounting (no native ETH escrow).
 */
contract EquipmentLending is Ownable {
    // --- Enums ---
    enum LoanState {
        Submitted,   // 0: Created / Pending approval
        Approved,    // 1: Approved by admin, equipment reserved
        Active,      // 2: Handover confirmed, in use
        Returned,    // 3: Successfully returned & inspected
        Cancelled,   // 4: Cancelled or rejected before handover
        Disputed     // 5: Damaged or lost; deposit forfeited
    }

    enum DepositState {
        None,        // 0: No deposit or pending
        Locked,      // 1: Deposit locked in simulated ledger
        Refunded,    // 2: Deposit refunded to student
        Forfeited    // 3: Deposit forfeited to university repair fund
    }

    // --- Structs ---
    struct LoanRecord {
        bytes32 loanId;
        uint256 equipmentId;
        address borrower;
        string studentId;
        uint256 requestTime;
        uint256 expectedHandover;
        uint256 dueDate;
        uint256 actualHandover;
        uint256 actualReturn;
        uint256 depositAmount;
        LoanState state;
        DepositState depositState;
        uint8 penaltyPercent;
    }

    // --- State Mappings ---
    mapping(bytes32 => LoanRecord) public loans;
    mapping(uint256 => bytes32) public activeEquipmentLoan;

    // --- Events ---
    event LoanCreated(
        bytes32 indexed loanId,
        uint256 indexed equipmentId,
        string studentId,
        address indexed borrower,
        uint256 dueDate,
        uint256 depositAmount
    );

    event LoanApproved(bytes32 indexed loanId, uint256 indexed equipmentId, uint256 timestamp);
    event HandoverConfirmed(bytes32 indexed loanId, uint256 timestamp);
    event LoanReturned(
        bytes32 indexed loanId,
        uint8 returnCondition,
        uint8 penaltyPercent,
        DepositState depositState,
        uint256 timestamp
    );
    event LoanCancelled(bytes32 indexed loanId, string reason, uint256 timestamp);

    // --- Constructor ---
    constructor(address initialOwner) Ownable(initialOwner) {}

    // --- Skeleton Functions for Phase 3 ---
    function getLoan(bytes32 _loanId) external view returns (LoanRecord memory) {
        return loans[_loanId];
    }

    function createLoan(
        bytes32 _loanId,
        uint256 _equipmentId,
        string calldata _studentId,
        address _borrower,
        uint256 _expectedHandover,
        uint256 _dueDate,
        uint256 _depositAmount
    ) external onlyOwner {
        require(loans[_loanId].loanId == bytes32(0), "Loan ID already exists");
        require(activeEquipmentLoan[_equipmentId] == bytes32(0), "Equipment already active in loan");

        loans[_loanId] = LoanRecord({
            loanId: _loanId,
            equipmentId: _equipmentId,
            borrower: _borrower,
            studentId: _studentId,
            requestTime: block.timestamp,
            expectedHandover: _expectedHandover,
            dueDate: _dueDate,
            actualHandover: 0,
            actualReturn: 0,
            depositAmount: _depositAmount,
            state: LoanState.Submitted,
            depositState: DepositState.None,
            penaltyPercent: 0
        });

        emit LoanCreated(_loanId, _equipmentId, _studentId, _borrower, _dueDate, _depositAmount);
    }

    function approveLoan(bytes32 _loanId) external onlyOwner {
        require(loans[_loanId].state == LoanState.Submitted, "Invalid state transition");
        uint256 eqId = loans[_loanId].equipmentId;
        require(activeEquipmentLoan[eqId] == bytes32(0), "Equipment already active");

        loans[_loanId].state = LoanState.Approved;
        activeEquipmentLoan[eqId] = _loanId;

        emit LoanApproved(_loanId, eqId, block.timestamp);
    }
}
