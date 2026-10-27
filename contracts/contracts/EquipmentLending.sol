// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title EquipmentLending
 * @author EduVault Team
 * @notice Quản lý vòng đời mượn trả thiết bị học tập trên blockchain.
 *
 * Đặc điểm chính:
 *   - Simulated Deposit Accounting: ghi nhận tiền cọc dạng số, KHÔNG giữ ETH thật.
 *   - Mutex thiết bị: mỗi thiết bị chỉ cho phép 1 đơn mượn Active tại một thời điểm.
 *   - Phạt tự động: trễ ≤24h → 10%, trễ >24h → 50%, hỏng/mất → tịch thu 100%.
 *   - Chỉ Owner (Admin Relayer) mới được gọi các hàm thay đổi trạng thái.
 */
contract EquipmentLending is Ownable {

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
        address  borrower;          // Địa chỉ ví đại diện sinh viên
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

    /// @notice Phát ra khi đơn mượn được tạo
    event LoanCreated(
        bytes32 indexed loanId,
        uint256 indexed equipmentId,
        string  studentId,
        address indexed borrower,
        uint256 dueDate,
        uint256 depositAmount
    );

    /// @notice Phát ra khi đơn mượn được duyệt
    event LoanApproved(
        bytes32 indexed loanId,
        uint256 indexed equipmentId,
        uint256 timestamp
    );

    /// @notice Phát ra khi xác nhận bàn giao thiết bị
    event HandoverConfirmed(
        bytes32 indexed loanId,
        uint256 timestamp
    );

    /// @notice Phát ra khi xác nhận trả thiết bị
    event LoanReturned(
        bytes32 indexed loanId,
        uint8   returnCondition,
        uint8   penaltyPercent,
        DepositState depositState,
        uint256 timestamp
    );

    /// @notice Phát ra khi đơn mượn bị hủy
    event LoanCancelled(
        bytes32 indexed loanId,
        string  reason,
        uint256 timestamp
    );

    // =========================================================================
    //                             CONSTRUCTOR
    // =========================================================================

    /// @param initialOwner Địa chỉ Admin Relayer (Hardhat Account #0)
    constructor(address initialOwner) Ownable(initialOwner) {}

    // =========================================================================
    //                           VIEW FUNCTIONS
    // =========================================================================

    /// @notice Lấy toàn bộ thông tin một đơn mượn
    /// @param _loanId ID của đơn mượn
    /// @return Bản ghi LoanRecord đầy đủ
    function getLoan(bytes32 _loanId) external view returns (LoanRecord memory) {
        return loans[_loanId];
    }

    /// @notice Kiểm tra đơn mượn có quá hạn hay không
    /// @param _loanId ID của đơn mượn
    /// @return true nếu đang Active và đã qua dueDate
    function isOverdue(bytes32 _loanId) external view returns (bool) {
        LoanRecord memory loan = loans[_loanId];
        return loan.state == LoanState.Active && block.timestamp > loan.dueDate;
    }

    /// @notice Tính toán mức phạt dựa trên tình trạng thiết bị và thời gian trả
    /// @param _loanId ID của đơn mượn
    /// @param _returnCondition 0=TỐT, 1=HỎNG, 2=MẤT
    /// @return penalty Phần trăm phạt (0, 10, 50 hoặc 100)
    /// @return depState Trạng thái cọc sau khi trả
    /// @return nextState Trạng thái đơn mượn sau khi trả
    function calculatePenalty(
        bytes32 _loanId,
        uint8   _returnCondition
    )
        public
        view
        returns (uint8 penalty, DepositState depState, LoanState nextState)
    {
        LoanRecord memory loan = loans[_loanId];

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
    //                        LIFECYCLE FUNCTIONS
    // =========================================================================

    /// @notice Tạo đơn mượn mới và ghi nhận lên blockchain
    /// @dev Chỉ Owner gọi. Kiểm tra: ID hợp lệ, không trùng, ngày hợp lệ.
    function createLoan(
        bytes32 _loanId,
        uint256 _equipmentId,
        string  calldata _studentId,
        address _borrower,
        uint256 _expectedHandover,
        uint256 _dueDate,
        uint256 _depositAmount
    ) external onlyOwner {
        require(_loanId != bytes32(0), "Invalid loan ID");
        require(loans[_loanId].loanId == bytes32(0), "Loan ID already exists");
        require(_dueDate > _expectedHandover, "Due date must be after handover");

        loans[_loanId] = LoanRecord({
            loanId:           _loanId,
            equipmentId:      _equipmentId,
            borrower:         _borrower,
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
            _borrower, _dueDate, _depositAmount
        );
    }

    /// @notice Duyệt đơn mượn và đặt Mutex giữ chỗ thiết bị
    /// @dev Kiểm tra: đơn tồn tại, trạng thái Submitted, thiết bị chưa bị khóa.
    function approveLoan(bytes32 _loanId) external onlyOwner {
        LoanRecord storage loan = loans[_loanId];
        require(loan.loanId != bytes32(0), "Loan does not exist");
        require(loan.state == LoanState.Submitted, "Invalid state transition");
        require(
            activeEquipmentLoan[loan.equipmentId] == bytes32(0),
            "Equipment already active"
        );

        // Chuyển trạng thái và khóa Mutex thiết bị
        loan.state = LoanState.Approved;
        activeEquipmentLoan[loan.equipmentId] = _loanId;

        emit LoanApproved(_loanId, loan.equipmentId, block.timestamp);
    }

    /// @notice Xác nhận bàn giao thiết bị thực tế và khóa cọc
    /// @dev Kiểm tra: đơn tồn tại và đang ở trạng thái Approved.
    function confirmHandover(bytes32 _loanId) external onlyOwner {
        LoanRecord storage loan = loans[_loanId];
        require(loan.loanId != bytes32(0), "Loan does not exist");
        require(loan.state == LoanState.Approved, "Loan not approved");

        // Chuyển sang Active, ghi nhận thời gian bàn giao
        loan.state = LoanState.Active;
        loan.actualHandover = block.timestamp;

        // Khóa cọc mô phỏng (nếu có)
        if (loan.depositAmount > 0) {
            loan.depositState = DepositState.Locked;
        }

        emit HandoverConfirmed(_loanId, block.timestamp);
    }

    /// @notice Xác nhận trả thiết bị, đánh giá tình trạng và áp dụng quy tắc phạt
    /// @param _loanId ID của đơn mượn
    /// @param _returnCondition 0=TỐT, 1=HỎNG, 2=MẤT
    /// @param _penaltyPercent Ghi đè mức phạt thủ công (0 = tự động tính)
    function confirmReturn(
        bytes32 _loanId,
        uint8   _returnCondition,
        uint8   _penaltyPercent
    ) external onlyOwner {
        LoanRecord storage loan = loans[_loanId];
        require(loan.loanId != bytes32(0), "Loan does not exist");
        require(loan.state == LoanState.Active, "Loan is not active");

        uint8 penalty;
        DepositState depState;
        LoanState nextState;

        if (_returnCondition == 1 || _returnCondition == 2) {
            // HỎNG hoặc MẤT → tịch thu toàn bộ cọc
            penalty   = 100;
            depState  = DepositState.Forfeited;
            nextState = LoanState.Disputed;
        } else {
            // Tình trạng TỐT → tính phạt tự động nếu _penaltyPercent == 0
            penalty = _penaltyPercent;
            if (penalty == 0 && block.timestamp > loan.dueDate) {
                if (block.timestamp <= loan.dueDate + 1 days) {
                    penalty = 10;   // Trễ ≤ 24h
                } else {
                    penalty = 50;   // Trễ > 24h
                }
            }
            depState  = DepositState.Refunded;
            nextState = LoanState.Returned;
        }

        // Cập nhật bản ghi
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

    /// @notice Hủy đơn mượn (chỉ khi chưa bàn giao: Submitted hoặc Approved)
    /// @param _loanId ID của đơn mượn
    /// @param _reason Lý do hủy
    function cancelLoan(
        bytes32 _loanId,
        string  calldata _reason
    ) external onlyOwner {
        LoanRecord storage loan = loans[_loanId];
        require(loan.loanId != bytes32(0), "Loan does not exist");
        require(
            loan.state == LoanState.Submitted ||
            loan.state == LoanState.Approved,
            "Cannot cancel active or closed loan"
        );

        // Nếu đã Approved → giải phóng Mutex thiết bị
        if (loan.state == LoanState.Approved) {
            activeEquipmentLoan[loan.equipmentId] = bytes32(0);
        }

        // Chuyển trạng thái sang Cancelled
        loan.state = LoanState.Cancelled;

        // Nếu cọc đã bị khóa → hoàn trả cọc
        if (loan.depositState == DepositState.Locked) {
            loan.depositState = DepositState.Refunded;
        }

        emit LoanCancelled(_loanId, _reason, block.timestamp);
    }
}
