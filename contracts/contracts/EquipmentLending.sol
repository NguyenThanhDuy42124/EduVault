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

    // --- View Functions ---
    function getLoan(bytes32 _loanId) external view returns (LoanRecord memory) {
        return loans[_loanId];
    }

    function isOverdue(bytes32 _loanId) external view returns (bool) {
        LoanRecord memory loan = loans[_loanId];
        return loan.state == LoanState.Active && block.timestamp > loan.dueDate;
    }

    function calculatePenalty(bytes32 _loanId, uint8 _returnCondition)
        public
        view
        returns (uint8 penalty, DepositState depState, LoanState nextState)
    {
        LoanRecord memory loan = loans[_loanId];
        if (_returnCondition == 1 || _returnCondition == 2) {
            // 1: DAMAGED, 2: LOST
            return (100, DepositState.Forfeited, LoanState.Disputed);
        }

        // 0: GOOD condition
        if (block.timestamp > loan.dueDate) {
            if (block.timestamp <= loan.dueDate + 1 days) {
                return (10, DepositState.Refunded, LoanState.Returned);
            } else {
                return (50, DepositState.Refunded, LoanState.Returned);
            }
        }
        return (0, DepositState.Refunded, LoanState.Returned);
    }

    // --- Lifecycle Functions ---

    /**
     * @notice Create a loan request record on-chain.
     */
    function createLoan(
        bytes32 _loanId,
        uint256 _equipmentId,
        string calldata _studentId,
        address _borrower,
        uint256 _expectedHandover,
        uint256 _dueDate,
        uint256 _depositAmount
    ) external onlyOwner {
        require(_loanId != bytes32(0), "Invalid loan ID");
        require(loans[_loanId].loanId == bytes32(0), "Loan ID already exists");
        require(_dueDate > _expectedHandover, "Due date must be after handover");

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

    /**
     * @notice Approve loan request and reserve equipment.
     */
    function approveLoan(bytes32 _loanId) external onlyOwner {
        LoanRecord storage loan = loans[_loanId];
        require(loan.loanId != bytes32(0), "Loan does not exist");
        require(loan.state == LoanState.Submitted, "Invalid state transition");
        require(activeEquipmentLoan[loan.equipmentId] == bytes32(0), "Equipment already active");

        loan.state = LoanState.Approved;
        activeEquipmentLoan[loan.equipmentId] = _loanId;

        emit LoanApproved(_loanId, loan.equipmentId, block.timestamp);
    }

    /**
     * @notice Confirm physical equipment handover and lock simulated deposit.
     */
    function confirmHandover(bytes32 _loanId) external onlyOwner {
        LoanRecord storage loan = loans[_loanId];
        require(loan.loanId != bytes32(0), "Loan does not exist");
        require(loan.state == LoanState.Approved, "Loan not approved");

        loan.state = LoanState.Active;
        loan.actualHandover = block.timestamp;
        if (loan.depositAmount > 0) {
            loan.depositState = DepositState.Locked;
        }

        emit HandoverConfirmed(_loanId, block.timestamp);
    }

    /**
     * @notice Confirm equipment return, assess condition and apply deposit penalty rules.
     * @param _loanId Unique loan identifier.
     * @param _returnCondition 0: GOOD, 1: DAMAGED, 2: LOST.
     * @param _penaltyPercent Custom penalty override (0 to use automatic rule).
     */
    function confirmReturn(
        bytes32 _loanId,
        uint8 _returnCondition,
        uint8 _penaltyPercent
    ) external onlyOwner {
        LoanRecord storage loan = loans[_loanId];
        require(loan.loanId != bytes32(0), "Loan does not exist");
        require(loan.state == LoanState.Active, "Loan is not active");

        uint8 penalty = _penaltyPercent;
        DepositState depState;
        LoanState nextState;

        if (_returnCondition == 1 || _returnCondition == 2) {
            // DAMAGED or LOST
            penalty = 100;
            depState = DepositState.Forfeited;
            nextState = LoanState.Disputed;
        } else {
            // GOOD condition: calculate standard penalty if 0 passed
            if (penalty == 0 && block.timestamp > loan.dueDate) {
                if (block.timestamp <= loan.dueDate + 1 days) {
                    penalty = 10;
                } else {
                    penalty = 50;
                }
            }
            depState = DepositState.Refunded;
            nextState = LoanState.Returned;
        }

        loan.actualReturn = block.timestamp;
        loan.penaltyPercent = penalty;
        loan.depositState = depState;
        loan.state = nextState;

        // Release equipment mutex
        activeEquipmentLoan[loan.equipmentId] = bytes32(0);

        emit LoanReturned(_loanId, _returnCondition, penalty, depState, block.timestamp);
    }

    /**
     * @notice Cancel loan prior to active usage (Submitted or Approved).
     */
    function cancelLoan(bytes32 _loanId, string calldata _reason) external onlyOwner {
        LoanRecord storage loan = loans[_loanId];
        require(loan.loanId != bytes32(0), "Loan does not exist");
        require(
            loan.state == LoanState.Submitted || loan.state == LoanState.Approved,
            "Cannot cancel active or closed loan"
        );

        if (loan.state == LoanState.Approved) {
            activeEquipmentLoan[loan.equipmentId] = bytes32(0);
        }

        loan.state = LoanState.Cancelled;
        if (loan.depositState == DepositState.Locked) {
            loan.depositState = DepositState.Refunded;
        }

        emit LoanCancelled(_loanId, _reason, block.timestamp);
    }
}
