// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title EquipmentLending
 * @author EduVault Team (Pure Web3 & Multi-Admin Upgrade - Phase 13)
 * @notice Quản lý vòng đời mượn trả thiết bị học tập trên blockchain theo chuẩn Pure Web3.
 *
 * Đặc điểm chính:
 *   - AccessControl đa vai trò:
 *       + DEFAULT_ADMIN_ROLE: Deployer quản lý danh sách Admin (addAdmin / removeAdmin).
 *       + ADMIN_ROLE: Nhóm cán bộ phòng lab (registerBorrower / revokeBorrower, duyệt, bàn giao, nhận lại máy).
 *       + BORROWER_ROLE: Sinh viên đã được cấp quyền qua ví MetaMask (bắt buộc khi createLoan).
 *   - Simulated Deposit Accounting: ghi nhận tiền cọc mô phỏng bằng số nguyên VND on-chain.
 *   - Mutex thiết bị: mỗi thiết bị chỉ cho phép 1 đơn mượn Approved/Active tại một thời điểm.
 *   - Phạt tự động 100% on-chain: đúng hạn → 0%, trễ ≤24h → 10%, trễ >24h → 50%, hỏng/mất → tịch thu 100%.
 */
contract EquipmentLending is AccessControl {

    // =========================================================================
    //                               ROLES
    // =========================================================================

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant BORROWER_ROLE = keccak256("BORROWER_ROLE");

    // =========================================================================
    //                               ENUMS
    // =========================================================================

    /// @notice Trạng thái vòng đời của một đơn mượn
    enum LoanState {
        Submitted,   // 0 - Đã gửi, chờ duyệt
        Approved,    // 1 - Đã duyệt, thiết bị được giữ chỗ
        Active,      // 2 - Đã bàn giao, đang sử dụng
        Returned,    // 3 - Đã trả thành công
        Cancelled,   // 4 - Đã hủy (trước khi bàn giao)
        Disputed     // 5 - Tranh chấp (hỏng hoặc mất, tịch thu cọc)
    }

    /// @notice Trạng thái tiền cọc mô phỏng
    enum DepositState {
        None,        // 0 - Chưa có cọc
        Locked,      // 1 - Cọc đã khóa (đang mượn)
        Refunded,    // 2 - Cọc đã hoàn trả
        Forfeited    // 3 - Cọc bị tịch thu (hỏng/mất)
    }

    // =========================================================================
    //                               STRUCTS
    // =========================================================================

    /// @notice Bản ghi đầy đủ của một đơn mượn thiết bị
    struct LoanRecord {
        bytes32  loanId;            // ID duy nhất (keccak256 hash)
        uint256  equipmentId;       // Mã thiết bị (tham chiếu MySQL)
        address  borrower;          // Địa chỉ ví của sinh viên (MetaMask)
        string   studentId;         // Mã sinh viên (VD: "SV2026001")
        uint256  requestTime;       // Thời điểm tạo đơn (block.timestamp)
        uint256  expectedHandover;  // Ngày dự kiến bàn giao
        uint256  dueDate;           // Hạn trả thiết bị
        uint256  actualHandover;    // Ngày bàn giao thực tế (0 nếu chưa)
        uint256  actualReturn;      // Ngày trả thực tế (0 nếu chưa)
        uint256  depositAmount;     // Số tiền cọc mô phỏng (VND)
        LoanState    state;         // Trạng thái đơn mượn
        DepositState depositState;  // Trạng thái tiền cọc
        uint8    penaltyPercent;    // Phần trăm phạt (0, 10, 50, 100)
    }

    // =========================================================================
    //                            STATE VARIABLES
    // =========================================================================

    /// @notice Lưu trữ tất cả đơn mượn theo loanId
    mapping(bytes32 => LoanRecord) public loans;

    /// @notice Mutex thiết bị: equipmentId → loanId đang Active (bytes32(0) = trống)
    mapping(uint256 => bytes32) public activeEquipmentLoan;

    // =========================================================================
    //                               EVENTS
    // =========================================================================

    event LoanCreated(
        bytes32 indexed loanId,
        uint256 indexed equipmentId,
        string  studentId,
        address indexed borrower,
        uint256 dueDate,
        uint256 depositAmount
    );

    event LoanApproved(
        bytes32 indexed loanId,
        uint256 indexed equipmentId,
        uint256 timestamp
    );

    event HandoverConfirmed(
        bytes32 indexed loanId,
        uint256 timestamp
    );

    event LoanReturned(
        bytes32 indexed loanId,
        uint8   returnCondition,
        uint8   penaltyPercent,
        DepositState depositState,
        uint256 timestamp
    );

    event LoanCancelled(
        bytes32 indexed loanId,
        string  reason,
        uint256 timestamp
    );

    event AdminAdded(
        address indexed account,
        address indexed grantedBy,
        uint256 timestamp
    );

    event AdminRemoved(
        address indexed account,
        address indexed revokedBy,
        uint256 timestamp
    );

    event BorrowerRegistered(
        address indexed account,
        address indexed registeredBy,
        uint256 timestamp
    );

    event BorrowerRevoked(
        address indexed account,
        address indexed revokedBy,
        uint256 timestamp
    );

    // =========================================================================
    //                             CONSTRUCTOR
    // =========================================================================

    /**
     * @param initialAdmin Địa chỉ Quản trị viên khởi tạo hệ thống (Deployer / Admin 1)
     */
    constructor(address initialAdmin) {
        require(initialAdmin != address(0), "Invalid admin address");
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(ADMIN_ROLE, initialAdmin);
    }

    // =========================================================================
    //                     MULTI-ADMIN & BORROWER ROLE MANAGEMENT
    // =========================================================================

    /**
     * @notice Cấp quyền ADMIN_ROLE cho thành viên ban quản trị (chỉ Deployer DEFAULT_ADMIN_ROLE).
     */
    function addAdmin(address _newAdmin) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_newAdmin != address(0), "Invalid admin address");
        if (_grantRole(ADMIN_ROLE, _newAdmin)) {
            emit AdminAdded(_newAdmin, msg.sender, block.timestamp);
        }
    }

    /**
     * @notice Thu hồi quyền ADMIN_ROLE của quản trị viên (chỉ Deployer DEFAULT_ADMIN_ROLE).
     */
    function removeAdmin(address _admin) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_admin != address(0), "Invalid admin address");
        require(_admin != msg.sender, "Cannot remove self");
        if (_revokeRole(ADMIN_ROLE, _admin)) {
            emit AdminRemoved(_admin, msg.sender, block.timestamp);
        }
    }

    /**
     * @notice Cấp quyền BORROWER_ROLE cho ví sinh viên để được phép tự tạo đơn on-chain.
     */
    function registerBorrower(address _student) external onlyRole(ADMIN_ROLE) {
        require(_student != address(0), "Invalid borrower address");
        if (_grantRole(BORROWER_ROLE, _student)) {
            emit BorrowerRegistered(_student, msg.sender, block.timestamp);
        }
    }

    /**
     * @notice Thu hồi quyền BORROWER_ROLE của sinh viên vi phạm.
     */
    function revokeBorrower(address _student) external onlyRole(ADMIN_ROLE) {
        require(_student != address(0), "Invalid borrower address");
        if (_revokeRole(BORROWER_ROLE, _student)) {
            emit BorrowerRevoked(_student, msg.sender, block.timestamp);
        }
    }

    // =========================================================================
    //                           VIEW FUNCTIONS
    // =========================================================================

    function getLoan(bytes32 _loanId) external view returns (LoanRecord memory) {
        return loans[_loanId];
    }

    function isOverdue(bytes32 _loanId) external view returns (bool) {
        LoanRecord memory loan = loans[_loanId];
        return loan.loanId != bytes32(0) && loan.state == LoanState.Active && block.timestamp > loan.dueDate;
    }

    function calculatePenalty(
        bytes32 _loanId,
        uint8   _returnCondition
    )
        public
        view
        returns (uint8 penalty, DepositState depState, LoanState nextState)
    {
        LoanRecord memory loan = loans[_loanId];
        require(loan.loanId != bytes32(0), "Loan does not exist");
        require(_returnCondition <= 2, "Invalid return condition");

        // Hỏng hoặc Mất → tịch thu 100% cọc
        if (_returnCondition == 1 || _returnCondition == 2) {
            return (100, DepositState.Forfeited, LoanState.Disputed);
        }

        // Tình trạng TỐT → kiểm tra quá hạn
        if (block.timestamp > loan.dueDate) {
            if (block.timestamp <= loan.dueDate + 1 days) {
                // Trễ ≤ 24 giờ → phạt 10%
                return (10, DepositState.Refunded, LoanState.Returned);
            } else {
                // Trễ > 24 giờ → phạt 50%
                return (50, DepositState.Refunded, LoanState.Returned);
            }
        }

        // Trả đúng hạn → không phạt, hoàn cọc 100%
        return (0, DepositState.Refunded, LoanState.Returned);
    }

    // =========================================================================
    //                        LIFECYCLE FUNCTIONS (PURE WEB3)
    // =========================================================================

    /**
     * @notice Sinh viên có BORROWER_ROLE tự ký tạo đơn mượn mới qua MetaMask.
     * @dev Bắt buộc msg.sender sở hữu BORROWER_ROLE; _borrower (nếu truyền) phải khớp msg.sender.
     */
    function createLoan(
        bytes32 _loanId,
        uint256 _equipmentId,
        string  calldata _studentId,
        address _borrower,
        uint256 _expectedHandover,
        uint256 _dueDate,
        uint256 _depositAmount
    ) external {
        require(hasRole(BORROWER_ROLE, msg.sender), "Must have BORROWER_ROLE to create loan");
        require(_loanId != bytes32(0), "Invalid loan ID");
        require(loans[_loanId].loanId == bytes32(0), "Loan ID already exists");
        require(_equipmentId > 0, "Invalid equipment ID");
        require(bytes(_studentId).length > 0, "Student ID cannot be empty");
        require(_expectedHandover > 0, "Invalid handover timestamp");
        require(_dueDate > _expectedHandover, "Due date must be after handover");
        require(_borrower == address(0) || _borrower == msg.sender, "Borrower address must match caller");

        address actualBorrower = msg.sender;

        loans[_loanId] = LoanRecord({
            loanId:           _loanId,
            equipmentId:      _equipmentId,
            borrower:         actualBorrower,
            studentId:        _studentId,
            requestTime:      block.timestamp,
            expectedHandover: _expectedHandover,
            dueDate:          _dueDate,
            actualHandover:   0,
            actualReturn:     0,
            depositAmount:    _depositAmount,
            state:            LoanState.Submitted,
            depositState:     DepositState.None,
            penaltyPercent:   0
        });

        emit LoanCreated(
            _loanId, _equipmentId, _studentId,
            actualBorrower, _dueDate, _depositAmount
        );
    }

    /**
     * @notice Duyệt đơn mượn và đặt Mutex giữ chỗ thiết bị.
     * @dev Chỉ Admin (ví có ADMIN_ROLE) được gọi qua MetaMask.
     */
    function approveLoan(bytes32 _loanId) external onlyRole(ADMIN_ROLE) {
        LoanRecord storage loan = loans[_loanId];
        require(loan.loanId != bytes32(0), "Loan does not exist");
        require(loan.state == LoanState.Submitted, "Invalid state transition");
        require(
            activeEquipmentLoan[loan.equipmentId] == bytes32(0),
            "Equipment already active"
        );

        loan.state = LoanState.Approved;
        activeEquipmentLoan[loan.equipmentId] = _loanId;

        emit LoanApproved(_loanId, loan.equipmentId, block.timestamp);
    }

    /**
     * @notice Xác nhận bàn giao thiết bị thực tế và khóa cọc.
     * @dev Chỉ Admin (ví có ADMIN_ROLE) được gọi qua MetaMask.
     */
    function confirmHandover(bytes32 _loanId) external onlyRole(ADMIN_ROLE) {
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
     * @notice Xác nhận trả thiết bị, đánh giá tình trạng và tự động tính phạt 100% on-chain.
     * @dev Chỉ Admin (ví có ADMIN_ROLE) được gọi qua MetaMask; loại bỏ hoàn toàn ghi đè thủ công.
     */
    function confirmReturn(
        bytes32 _loanId,
        uint8   _returnCondition
    ) external onlyRole(ADMIN_ROLE) {
        LoanRecord storage loan = loans[_loanId];
        require(loan.loanId != bytes32(0), "Loan does not exist");
        require(loan.state == LoanState.Active, "Loan is not active");

        (uint8 penalty, DepositState depState, LoanState nextState) = calculatePenalty(
            _loanId,
            _returnCondition
        );

        loan.actualReturn   = block.timestamp;
        loan.penaltyPercent = penalty;
        loan.depositState   = depState;
        loan.state          = nextState;

        // Giải phóng Mutex thiết bị
        activeEquipmentLoan[loan.equipmentId] = bytes32(0);

        emit LoanReturned(
            _loanId, _returnCondition, penalty, depState, block.timestamp
        );
    }

    /**
     * @notice Hủy đơn mượn (chỉ khi chưa bàn giao: Submitted hoặc Approved).
     * @dev Cho phép:
     *   1. Chính Sinh viên mượn (msg.sender == loan.borrower) tự hủy qua MetaMask.
     *   2. Hoặc bất kỳ Admin (ADMIN_ROLE) nào hủy hộ.
     */
    function cancelLoan(
        bytes32 _loanId,
        string  calldata _reason
    ) external {
        LoanRecord storage loan = loans[_loanId];
        require(loan.loanId != bytes32(0), "Loan does not exist");
        require(
            hasRole(ADMIN_ROLE, msg.sender) || msg.sender == loan.borrower,
            "Not authorized to cancel"
        );
        require(
            loan.state == LoanState.Submitted ||
            loan.state == LoanState.Approved,
            "Cannot cancel active or closed loan"
        );

        if (loan.state == LoanState.Approved) {
            activeEquipmentLoan[loan.equipmentId] = bytes32(0);
        }

        loan.state = LoanState.Cancelled;

        emit LoanCancelled(_loanId, _reason, block.timestamp);
    }
}
