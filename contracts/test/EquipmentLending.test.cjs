const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("EquipmentLending - Kiểm thử toàn diện Pure Web3 & Multi-Admin (Phase 13)", function () {
  let contract;
  let owner, admin2, admin3, student, student2, unauthorized;
  let Factory;

  // Dữ liệu mẫu dùng chung
  const EQUIPMENT_ID = 101;
  const STUDENT_ID = "SV2026001";
  const DEPOSIT = 500000; // 500,000 VND mô phỏng
  const ONE_DAY = 86400;  // 1 ngày = 86400 giây

  // Enum values đồng bộ EquipmentLending.sol
  const State = {
    Submitted: 0, Approved: 1, Active: 2,
    Returned: 3, Cancelled: 4, Disputed: 5
  };
  const Deposit = {
    None: 0, Locked: 1, Refunded: 2, Forfeited: 3
  };

  function loanId(label) {
    return ethers.keccak256(ethers.toUtf8Bytes(`test_${label}`));
  }

  // Helper: Sinh viên có BORROWER_ROLE tự ký createLoan qua ví MetaMask
  async function createDefaultLoan(id, overrides = {}) {
    const now = await time.latest();
    const signer = overrides.signer ?? student;
    const params = {
      loanId: id,
      equipmentId: overrides.equipmentId ?? EQUIPMENT_ID,
      studentId: overrides.studentId ?? STUDENT_ID,
      borrower: overrides.borrower !== undefined ? overrides.borrower : signer.address,
      expectedHandover: overrides.expectedHandover ?? now,
      dueDate: overrides.dueDate ?? (now + ONE_DAY * 3),
      depositAmount: overrides.depositAmount ?? DEPOSIT,
    };
    await contract.connect(signer).createLoan(
      params.loanId, params.equipmentId, params.studentId,
      params.borrower, params.expectedHandover, params.dueDate,
      params.depositAmount
    );
    return params;
  }

  // Helper: Đưa đơn mượn qua trạng thái Active (Student Create -> Admin Approve -> Admin Handover)
  async function advanceToActive(id, overrides = {}) {
    const params = await createDefaultLoan(id, overrides);
    const adminSigner = overrides.adminSigner ?? owner;
    await contract.connect(adminSigner).approveLoan(id);
    await contract.connect(adminSigner).confirmHandover(id);
    return params;
  }

  beforeEach(async function () {
    [owner, admin2, admin3, student, student2, unauthorized] = await ethers.getSigners();
    Factory = await ethers.getContractFactory("EquipmentLending");
    contract = await Factory.deploy(owner.address);
    await contract.waitForDeployment();

    // Cấp quyền BORROWER_ROLE mặc định cho student phục vụ các kịch bản lifecycle
    await contract.connect(owner).registerBorrower(student.address);
  });

  // =========================================================================
  // 1. DEPLOYMENT, MULTI-ADMIN & BORROWER ROLES
  // =========================================================================
  describe("1. Deployment, Multi-Admin & Borrower Access Control", function () {
    it("1.1 Deploy cấp DEFAULT_ADMIN_ROLE + ADMIN_ROLE cho initialAdmin, chặn address(0)", async function () {
      const DEFAULT_ADMIN_ROLE = await contract.DEFAULT_ADMIN_ROLE();
      const ADMIN_ROLE = await contract.ADMIN_ROLE();
      const BORROWER_ROLE = await contract.BORROWER_ROLE();

      expect(await contract.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await contract.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
      expect(await contract.hasRole(BORROWER_ROLE, owner.address)).to.be.false;

      await expect(Factory.deploy(ethers.ZeroAddress)).to.be.revertedWith("Invalid admin address");
    });

    it("1.2 addAdmin & removeAdmin hoạt động đúng và chặn gọi trái phép", async function () {
      const ADMIN_ROLE = await contract.ADMIN_ROLE();

      // Deployer thêm admin2 & admin3
      await expect(contract.connect(owner).addAdmin(admin2.address))
        .to.emit(contract, "AdminAdded")
        .withArgs(admin2.address, owner.address, anyValue);
      await contract.connect(owner).addAdmin(admin3.address);

      expect(await contract.hasRole(ADMIN_ROLE, admin2.address)).to.be.true;
      expect(await contract.hasRole(ADMIN_ROLE, admin3.address)).to.be.true;

      // Chặn non-deployer hoặc address(0)
      await expect(contract.connect(admin2).addAdmin(unauthorized.address))
        .to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount");
      await expect(contract.connect(owner).addAdmin(ethers.ZeroAddress))
        .to.be.revertedWith("Invalid admin address");
      await expect(contract.connect(owner).removeAdmin(owner.address))
        .to.be.revertedWith("Cannot remove self");
      await expect(contract.connect(owner).removeAdmin(ethers.ZeroAddress))
        .to.be.revertedWith("Invalid admin address");

      // Thu hồi admin2 -> admin2 không còn quyền approveLoan
      await expect(contract.connect(owner).removeAdmin(admin2.address))
        .to.emit(contract, "AdminRemoved");
      expect(await contract.hasRole(ADMIN_ROLE, admin2.address)).to.be.false;

      const id = loanId("revoked_admin");
      await createDefaultLoan(id);
      await expect(contract.connect(admin2).approveLoan(id))
        .to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount");
    });

    it("1.3 registerBorrower & revokeBorrower cho phép ADMIN_ROLE quản lý quyền mượn", async function () {
      const BORROWER_ROLE = await contract.BORROWER_ROLE();
      await contract.connect(owner).addAdmin(admin2.address);

      // Admin thứ 2 cấp BORROWER_ROLE cho student2
      await expect(contract.connect(admin2).registerBorrower(student2.address))
        .to.emit(contract, "BorrowerRegistered");
      expect(await contract.hasRole(BORROWER_ROLE, student2.address)).to.be.true;

      // Chặn student/unauthorized tự cấp quyền và chặn zero address
      await expect(contract.connect(student).registerBorrower(unauthorized.address))
        .to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount");
      await expect(contract.connect(admin2).registerBorrower(ethers.ZeroAddress))
        .to.be.revertedWith("Invalid borrower address");

      // Thu hồi quyền của student2 -> student2 bị chặn createLoan
      await expect(contract.connect(admin2).revokeBorrower(student2.address))
        .to.emit(contract, "BorrowerRevoked");
      expect(await contract.hasRole(BORROWER_ROLE, student2.address)).to.be.false;

      const now = await time.latest();
      await expect(
        contract.connect(student2).createLoan(
          loanId("revoked_borrower"), EQUIPMENT_ID, "SV2026002",
          student2.address, now, now + ONE_DAY, DEPOSIT
        )
      ).to.be.revertedWith("Must have BORROWER_ROLE to create loan");
    });

    it("1.4 Cross-Wallet Multi-Admin: Student tạo → Admin 2 duyệt → Admin 3 bàn giao → Admin 1 trả máy", async function () {
      await contract.connect(owner).addAdmin(admin2.address);
      await contract.connect(owner).addAdmin(admin3.address);

      const id = loanId("cross_wallet_e2e");
      await createDefaultLoan(id, { signer: student });

      await expect(contract.connect(admin2).approveLoan(id)).to.emit(contract, "LoanApproved");
      await expect(contract.connect(admin3).confirmHandover(id)).to.emit(contract, "HandoverConfirmed");
      await expect(contract.connect(owner).confirmReturn(id, 0)).to.emit(contract, "LoanReturned");

      const loan = await contract.getLoan(id);
      expect(loan.borrower).to.equal(student.address);
      expect(loan.state).to.equal(State.Returned);
      expect(loan.depositState).to.equal(Deposit.Refunded);
      expect(loan.penaltyPercent).to.equal(0);
    });

    it("1.5 Từ chối ví chưa được cấp quyền cho createLoan / approveLoan / handover / return", async function () {
      const now = await time.latest();
      const id = loanId("unauth_all");

      // Tài khoản chưa có BORROWER_ROLE (kể cả Admin 1 nếu chưa đăng ký borrower) không thể gọi createLoan
      await expect(
        contract.connect(unauthorized).createLoan(
          id, EQUIPMENT_ID, STUDENT_ID, unauthorized.address, now, now + ONE_DAY, DEPOSIT
        )
      ).to.be.revertedWith("Must have BORROWER_ROLE to create loan");
      await expect(
        contract.connect(owner).createLoan(
          id, EQUIPMENT_ID, STUDENT_ID, student.address, now, now + ONE_DAY, DEPOSIT
        )
      ).to.be.revertedWith("Must have BORROWER_ROLE to create loan");

      // Tạo đơn hợp lệ từ student, sau đó chặn unauthorized trên các hàm quản trị
      await createDefaultLoan(id);
      await expect(contract.connect(unauthorized).approveLoan(id))
        .to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount");
      await expect(contract.connect(student).approveLoan(id))
        .to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount");

      await contract.connect(owner).approveLoan(id);
      await expect(contract.connect(unauthorized).confirmHandover(id))
        .to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount");

      await contract.connect(owner).confirmHandover(id);
      await expect(contract.connect(unauthorized).confirmReturn(id, 0))
        .to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount");
    });
  });

  // =========================================================================
  // 2. LUỒNG CHUẨN: TRẢ ĐÚNG HẠN (0% penalty)
  // =========================================================================
  describe("2. Luồng chuẩn - Trả đúng hạn (0% penalty)", function () {
    it("2.1 Student Create → Approve → Handover → Return on-time (2 args)", async function () {
      const id = loanId("standard_flow");
      const now = await time.latest();
      const dueDate = now + ONE_DAY * 3;

      await expect(
        contract.connect(student).createLoan(
          id, EQUIPMENT_ID, STUDENT_ID, student.address,
          now, dueDate, DEPOSIT
        )
      ).to.emit(contract, "LoanCreated")
       .withArgs(id, EQUIPMENT_ID, STUDENT_ID, student.address, dueDate, DEPOSIT);

      let loan = await contract.getLoan(id);
      expect(loan.state).to.equal(State.Submitted);
      expect(loan.depositState).to.equal(Deposit.None);
      expect(loan.borrower).to.equal(student.address);

      await expect(contract.connect(owner).approveLoan(id)).to.emit(contract, "LoanApproved");
      loan = await contract.getLoan(id);
      expect(loan.state).to.equal(State.Approved);
      expect(await contract.activeEquipmentLoan(EQUIPMENT_ID)).to.equal(id);

      await expect(contract.connect(owner).confirmHandover(id)).to.emit(contract, "HandoverConfirmed");
      loan = await contract.getLoan(id);
      expect(loan.state).to.equal(State.Active);
      expect(loan.depositState).to.equal(Deposit.Locked);
      expect(loan.actualHandover).to.be.gt(0);
      expect(await contract.isOverdue(id)).to.be.false;

      // Bước 4: confirmReturn chỉ nhận 2 tham số, tự động tính 0% khi đúng hạn
      await expect(contract.connect(owner).confirmReturn(id, 0)).to.emit(contract, "LoanReturned");

      loan = await contract.getLoan(id);
      expect(loan.state).to.equal(State.Returned);
      expect(loan.depositState).to.equal(Deposit.Refunded);
      expect(loan.penaltyPercent).to.equal(0);
      expect(loan.actualReturn).to.be.gt(0);
      expect(await contract.activeEquipmentLoan(EQUIPMENT_ID)).to.equal(ethers.ZeroHash);
    });
  });

  // =========================================================================
  // 3. QUY TẮC PHẠT QUÁ HẠN TỰ ĐỘNG ON-CHAIN
  // =========================================================================
  describe("3. Quy tắc phạt quá hạn tự động on-chain", function () {
    let id, dueDate;

    beforeEach(async function () {
      id = loanId("overdue_base");
      const now = await time.latest();
      dueDate = now + ONE_DAY;

      await contract.connect(student).createLoan(
        id, EQUIPMENT_ID, STUDENT_ID, student.address,
        now, dueDate, DEPOSIT
      );
      await contract.connect(owner).approveLoan(id);
      await contract.connect(owner).confirmHandover(id);
    });

    it("3.1 Trễ ≤ 24h → tự động phạt 10%, cọc hoàn trả", async function () {
      await time.increaseTo(dueDate + 12 * 3600);
      expect(await contract.isOverdue(id)).to.be.true;

      const calc = await contract.calculatePenalty(id, 0);
      expect(calc.penalty).to.equal(10);
      expect(calc.depState).to.equal(Deposit.Refunded);
      expect(calc.nextState).to.equal(State.Returned);

      await contract.connect(owner).confirmReturn(id, 0);
      const loan = await contract.getLoan(id);
      expect(loan.penaltyPercent).to.equal(10);
      expect(loan.state).to.equal(State.Returned);
      expect(loan.depositState).to.equal(Deposit.Refunded);
    });

    it("3.2 Trễ > 24h → tự động phạt 50%, cọc hoàn trả", async function () {
      await time.increaseTo(dueDate + 36 * 3600);
      expect(await contract.isOverdue(id)).to.be.true;

      const calc = await contract.calculatePenalty(id, 0);
      expect(calc.penalty).to.equal(50);

      await contract.connect(owner).confirmReturn(id, 0);
      const loan = await contract.getLoan(id);
      expect(loan.penaltyPercent).to.equal(50);
      expect(loan.state).to.equal(State.Returned);
      expect(loan.depositState).to.equal(Deposit.Refunded);
    });
  });

  // =========================================================================
  // 4. THIẾT BỊ HỎNG / MẤT → TỊCH THU 100% CỌC
  // =========================================================================
  describe("4. Hỏng / Mất → Tịch thu 100% cọc", function () {
    it("4.1 HỎNG (condition=1) → penalty 100%, Forfeited, Disputed, giải phóng Mutex", async function () {
      const id = loanId("damaged");
      await advanceToActive(id);

      await contract.connect(owner).confirmReturn(id, 1);
      const loan = await contract.getLoan(id);
      expect(loan.penaltyPercent).to.equal(100);
      expect(loan.depositState).to.equal(Deposit.Forfeited);
      expect(loan.state).to.equal(State.Disputed);
      expect(await contract.activeEquipmentLoan(EQUIPMENT_ID)).to.equal(ethers.ZeroHash);
    });

    it("4.2 MẤT (condition=2) → penalty 100%, Forfeited, Disputed, giải phóng Mutex", async function () {
      const id = loanId("lost");
      await advanceToActive(id);

      await contract.connect(owner).confirmReturn(id, 2);
      const loan = await contract.getLoan(id);
      expect(loan.penaltyPercent).to.equal(100);
      expect(loan.depositState).to.equal(Deposit.Forfeited);
      expect(loan.state).to.equal(State.Disputed);
      expect(await contract.activeEquipmentLoan(EQUIPMENT_ID)).to.equal(ethers.ZeroHash);
    });
  });

  // =========================================================================
  // 5. HỦY ĐƠN MƯỢN
  // =========================================================================
  describe("5. Hủy đơn mượn", function () {
    it("5.1 Sinh viên tự hủy đơn ở trạng thái Submitted", async function () {
      const id = loanId("cancel_submitted");
      await createDefaultLoan(id);

      await expect(contract.connect(student).cancelLoan(id, "Sinh viên đổi ý"))
        .to.emit(contract, "LoanCancelled");

      const loan = await contract.getLoan(id);
      expect(loan.state).to.equal(State.Cancelled);
      expect(loan.depositState).to.equal(Deposit.None);
    });

    it("5.2 Admin hủy đơn ở trạng thái Approved → giải phóng Mutex", async function () {
      const id = loanId("cancel_approved");
      await createDefaultLoan(id);
      await contract.connect(owner).approveLoan(id);

      expect(await contract.activeEquipmentLoan(EQUIPMENT_ID)).to.equal(id);

      await contract.connect(owner).cancelLoan(id, "Thiết bị cần bảo trì");

      const loan = await contract.getLoan(id);
      expect(loan.state).to.equal(State.Cancelled);
      expect(loan.depositState).to.equal(Deposit.None);
      expect(await contract.activeEquipmentLoan(EQUIPMENT_ID)).to.equal(ethers.ZeroHash);
    });

    it("5.3 Người không liên quan KHÔNG thể hủy đơn", async function () {
      const id = loanId("cancel_unauth");
      await createDefaultLoan(id);

      await expect(contract.connect(unauthorized).cancelLoan(id, "Hủy lậu"))
        .to.be.revertedWith("Not authorized to cancel");
    });

    it("5.4 KHÔNG thể hủy đơn đang Active hoặc đã Returned", async function () {
      const id1 = loanId("cancel_active");
      await advanceToActive(id1);
      await expect(contract.connect(student).cancelLoan(id1, "Thử hủy khi đang mượn"))
        .to.be.revertedWith("Cannot cancel active or closed loan");

      const id2 = loanId("cancel_returned");
      await advanceToActive(id2, { equipmentId: 102 });
      await contract.connect(owner).confirmReturn(id2, 0);
      await expect(contract.connect(owner).cancelLoan(id2, "Thử hủy khi đã trả"))
        .to.be.revertedWith("Cannot cancel active or closed loan");
    });
  });

  // =========================================================================
  // 6. MUTEX CHỐNG ĐẶT TRÙNG THIẾT BỊ
  // =========================================================================
  describe("6. Mutex chống đặt trùng thiết bị", function () {
    it("6.1 Từ chối duyệt đơn thứ 2 cho cùng thiết bị", async function () {
      const id1 = loanId("mutex_1");
      const id2 = loanId("mutex_2");

      await createDefaultLoan(id1);
      await createDefaultLoan(id2, { studentId: "SV2026002" });

      await contract.connect(owner).approveLoan(id1);
      await expect(contract.connect(owner).approveLoan(id2))
        .to.be.revertedWith("Equipment already active");
    });

    it("6.2 Cho phép duyệt đơn mới sau khi đơn cũ trả xong hoặc Disputed", async function () {
      const id1 = loanId("mutex_cycle_1");
      const id2 = loanId("mutex_cycle_2");
      const id3 = loanId("mutex_cycle_3");

      await advanceToActive(id1);
      await contract.connect(owner).confirmReturn(id1, 0);

      await createDefaultLoan(id2, { studentId: "SV2026002" });
      await contract.connect(owner).approveLoan(id2);
      expect(await contract.activeEquipmentLoan(EQUIPMENT_ID)).to.equal(id2);

      // Đơn 2 chuyển Disputed -> vẫn giải phóng Mutex cho đơn 3
      await contract.connect(owner).confirmHandover(id2);
      await contract.connect(owner).confirmReturn(id2, 1);

      await createDefaultLoan(id3, { studentId: "SV2026003" });
      await expect(contract.connect(owner).approveLoan(id3)).to.not.be.reverted;
      expect(await contract.activeEquipmentLoan(EQUIPMENT_ID)).to.equal(id3);
    });

    it("6.3 Cho phép duyệt đơn mới sau khi đơn cũ bị hủy", async function () {
      const id1 = loanId("mutex_cancel_1");
      const id2 = loanId("mutex_cancel_2");

      await createDefaultLoan(id1);
      await contract.connect(owner).approveLoan(id1);
      await contract.connect(student).cancelLoan(id1, "Hủy bỏ");

      await createDefaultLoan(id2, { studentId: "SV2026002" });
      await expect(contract.connect(owner).approveLoan(id2)).to.not.be.reverted;
    });
  });

  // =========================================================================
  // 7. VALIDATE ĐẦU VÀO & CHỐNG TRÙNG LOAN ID / SPOOFING
  // =========================================================================
  describe("7. Validate đầu vào & chống trùng Loan ID", function () {
    it("7.1 Từ chối tạo đơn có ID trùng", async function () {
      const id = loanId("dup_id");
      await createDefaultLoan(id);

      const now = await time.latest();
      await expect(
        contract.connect(student).createLoan(
          id, 999, "SV999", student.address, now, now + ONE_DAY, DEPOSIT
        )
      ).to.be.revertedWith("Loan ID already exists");
    });

    it("7.2 Từ chối loanId=0, equipmentId=0, studentId rỗng, timestamp=0, ngày sai, hoặc spoof borrower", async function () {
      const now = await time.latest();

      await expect(
        contract.connect(student).createLoan(
          ethers.ZeroHash, EQUIPMENT_ID, STUDENT_ID, student.address, now, now + ONE_DAY, DEPOSIT
        )
      ).to.be.revertedWith("Invalid loan ID");

      await expect(
        contract.connect(student).createLoan(
          loanId("eq_zero"), 0, STUDENT_ID, student.address, now, now + ONE_DAY, DEPOSIT
        )
      ).to.be.revertedWith("Invalid equipment ID");

      await expect(
        contract.connect(student).createLoan(
          loanId("stu_empty"), EQUIPMENT_ID, "", student.address, now, now + ONE_DAY, DEPOSIT
        )
      ).to.be.revertedWith("Student ID cannot be empty");

      await expect(
        contract.connect(student).createLoan(
          loanId("handover_zero"), EQUIPMENT_ID, STUDENT_ID, student.address, 0, now + ONE_DAY, DEPOSIT
        )
      ).to.be.revertedWith("Invalid handover timestamp");

      await expect(
        contract.connect(student).createLoan(
          loanId("bad_dates"), EQUIPMENT_ID, STUDENT_ID, student.address, now + ONE_DAY, now, DEPOSIT
        )
      ).to.be.revertedWith("Due date must be after handover");

      await expect(
        contract.connect(student).createLoan(
          loanId("spoof_borrower"), EQUIPMENT_ID, STUDENT_ID, student2.address, now, now + ONE_DAY, DEPOSIT
        )
      ).to.be.revertedWith("Borrower address must match caller");
    });

    it("7.3 Chấp nhận _borrower = address(0) (tự gán msg.sender) và từ chối returnCondition > 2", async function () {
      const id = loanId("zero_borrower_arg");
      await createDefaultLoan(id, { borrower: ethers.ZeroAddress });
      const created = await contract.getLoan(id);
      expect(created.borrower).to.equal(student.address);

      await contract.connect(owner).approveLoan(id);
      await contract.connect(owner).confirmHandover(id);

      await expect(contract.calculatePenalty(id, 3))
        .to.be.revertedWith("Invalid return condition");
      await expect(contract.connect(owner).confirmReturn(id, 3))
        .to.be.revertedWith("Invalid return condition");
    });
  });

  // =========================================================================
  // 8. KIỂM TRA CHUYỂN TRẠNG THÁI KHÔNG HỢP LỆ (REVERT)
  // =========================================================================
  describe("8. Chuyển trạng thái không hợp lệ", function () {
    it("8.1 Không thể bàn giao đơn chưa duyệt (Submitted)", async function () {
      const id = loanId("handover_no_approve");
      await createDefaultLoan(id);
      await expect(contract.connect(owner).confirmHandover(id)).to.be.revertedWith("Loan not approved");
    });

    it("8.2 Không thể trả thiết bị khi đơn chưa Active", async function () {
      const id = loanId("return_no_active");
      await createDefaultLoan(id);
      await contract.connect(owner).approveLoan(id);
      await expect(contract.connect(owner).confirmReturn(id, 0)).to.be.revertedWith("Loan is not active");
    });

    it("8.3 Không thể duyệt lại đơn đã Approved", async function () {
      const id = loanId("double_approve");
      await createDefaultLoan(id);
      await contract.connect(owner).approveLoan(id);
      await expect(contract.connect(owner).approveLoan(id)).to.be.revertedWith("Invalid state transition");
    });

    it("8.4 Không thể thao tác trên loanId không tồn tại", async function () {
      const fakeId = loanId("nonexistent");
      await expect(contract.connect(owner).approveLoan(fakeId)).to.be.revertedWith("Loan does not exist");
      await expect(contract.connect(owner).confirmHandover(fakeId)).to.be.revertedWith("Loan does not exist");
      await expect(contract.connect(owner).confirmReturn(fakeId, 0)).to.be.revertedWith("Loan does not exist");
      await expect(contract.connect(owner).cancelLoan(fakeId, "test")).to.be.revertedWith("Loan does not exist");
      await expect(contract.calculatePenalty(fakeId, 0)).to.be.revertedWith("Loan does not exist");
    });
  });

  // =========================================================================
  // 9. VIEW FUNCTIONS
  // =========================================================================
  describe("9. View Functions", function () {
    it("9.1 getLoan trả đủ thông tin", async function () {
      const id = loanId("view_test");
      await createDefaultLoan(id);

      const loan = await contract.getLoan(id);
      expect(loan.loanId).to.equal(id);
      expect(loan.equipmentId).to.equal(EQUIPMENT_ID);
      expect(loan.borrower).to.equal(student.address);
      expect(loan.studentId).to.equal(STUDENT_ID);
      expect(loan.depositAmount).to.equal(DEPOSIT);
      expect(loan.state).to.equal(State.Submitted);
      expect(loan.depositState).to.equal(Deposit.None);
      expect(loan.penaltyPercent).to.equal(0);
    });

    it("9.2 isOverdue trả false khi chưa quá hạn hoặc không tồn tại", async function () {
      expect(await contract.isOverdue(loanId("missing"))).to.be.false;
      const id = loanId("not_overdue");
      await advanceToActive(id);
      expect(await contract.isOverdue(id)).to.be.false;
    });

    it("9.3 isOverdue trả true khi đã quá hạn", async function () {
      const id = loanId("is_overdue");
      const now = await time.latest();
      const dueDate = now + ONE_DAY;

      await createDefaultLoan(id, { dueDate });
      await contract.connect(owner).approveLoan(id);
      await contract.connect(owner).confirmHandover(id);

      await time.increaseTo(dueDate + 1);
      expect(await contract.isOverdue(id)).to.be.true;
    });

    it("9.4 calculatePenalty cho kết quả đúng với từng condition", async function () {
      const id = loanId("calc_penalty");
      await advanceToActive(id);

      let result = await contract.calculatePenalty(id, 0);
      expect(result.penalty).to.equal(0);
      expect(result.depState).to.equal(Deposit.Refunded);

      result = await contract.calculatePenalty(id, 1);
      expect(result.penalty).to.equal(100);
      expect(result.depState).to.equal(Deposit.Forfeited);

      result = await contract.calculatePenalty(id, 2);
      expect(result.penalty).to.equal(100);
      expect(result.depState).to.equal(Deposit.Forfeited);
    });
  });

  // =========================================================================
  // 10. EDGE CASES & ABI CHUẨN HÓA PHASE 13
  // =========================================================================
  describe("10. Edge cases & chuẩn hóa ABI Phase 13", function () {
    it("10.1 Thiết bị không có cọc (deposit=0) → depositState giữ None", async function () {
      const id = loanId("no_deposit");
      await advanceToActive(id, { depositAmount: 0 });

      const loan = await contract.getLoan(id);
      expect(loan.depositAmount).to.equal(0);
      expect(loan.depositState).to.equal(Deposit.None);
    });

    it("10.2 Nhiều thiết bị khác nhau có thể mượn đồng thời", async function () {
      const id1 = loanId("multi_eq_1");
      const id2 = loanId("multi_eq_2");

      await createDefaultLoan(id1, { equipmentId: 101 });
      await createDefaultLoan(id2, { equipmentId: 202 });

      await contract.connect(owner).approveLoan(id1);
      await contract.connect(owner).approveLoan(id2);

      expect(await contract.activeEquipmentLoan(101)).to.equal(id1);
      expect(await contract.activeEquipmentLoan(202)).to.equal(id2);
    });

    it("10.3 Signature confirmReturn đúng 2 tham số, không thể ghi đè phạt thủ công", async function () {
      const fn = contract.interface.getFunction("confirmReturn");
      expect(fn.inputs.length).to.equal(2);
      expect(fn.inputs[0].type).to.equal("bytes32");
      expect(fn.inputs[1].type).to.equal("uint8");
    });
  });
});
