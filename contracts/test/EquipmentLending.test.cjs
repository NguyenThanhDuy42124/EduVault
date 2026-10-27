const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("EquipmentLending - Kiểm thử toàn diện vòng đời mượn trả", function () {
  let contract;
  let owner, student, unauthorized;

  // Dữ liệu mẫu dùng chung
  const EQUIPMENT_ID = 101;
  const STUDENT_ID = "SV2026001";
  const DEPOSIT = 500000; // 500,000 VND mô phỏng
  const ONE_DAY = 86400;  // 1 ngày = 86400 giây

  // Enum values để đọc test dễ hơn
  const State = {
    Submitted: 0, Approved: 1, Active: 2,
    Returned: 3, Cancelled: 4, Disputed: 5
  };
  const Deposit = {
    None: 0, Locked: 1, Refunded: 2, Forfeited: 3
  };

  // Tạo loanId duy nhất từ chuỗi mô tả
  function loanId(label) {
    return ethers.keccak256(ethers.toUtf8Bytes(`test_${label}`));
  }

  // Helper: Tạo đơn mượn với giá trị mặc định, cho phép override
  async function createDefaultLoan(id, overrides = {}) {
    const now = await time.latest();
    const params = {
      loanId: id,
      equipmentId: overrides.equipmentId ?? EQUIPMENT_ID,
      studentId: overrides.studentId ?? STUDENT_ID,
      borrower: overrides.borrower ?? student.address,
      expectedHandover: overrides.expectedHandover ?? now,
      dueDate: overrides.dueDate ?? (now + ONE_DAY * 3),
      depositAmount: overrides.depositAmount ?? DEPOSIT,
    };
    await contract.createLoan(
      params.loanId, params.equipmentId, params.studentId,
      params.borrower, params.expectedHandover, params.dueDate,
      params.depositAmount
    );
    return params;
  }

  // Helper: Đưa đơn mượn qua trạng thái Active (Create → Approve → Handover)
  async function advanceToActive(id, overrides = {}) {
    const params = await createDefaultLoan(id, overrides);
    await contract.approveLoan(id);
    await contract.confirmHandover(id);
    return params;
  }

  beforeEach(async function () {
    [owner, student, unauthorized] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("EquipmentLending");
    contract = await Factory.deploy(owner.address);
    await contract.waitForDeployment();
  });

  // =========================================================================
  // 1. DEPLOYMENT & OWNERSHIP
  // =========================================================================
  describe("1. Deployment & Ownership", function () {
    it("1.1 Deploy thành công với owner đúng", async function () {
      expect(await contract.owner()).to.equal(owner.address);
    });

    it("1.2 Từ chối giao dịch từ tài khoản không phải owner", async function () {
      const id = loanId("unauth");
      const now = await time.latest();
      await expect(
        contract.connect(unauthorized).createLoan(
          id, EQUIPMENT_ID, STUDENT_ID, student.address,
          now, now + ONE_DAY, DEPOSIT
        )
      ).to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount");
    });
  });

  // =========================================================================
  // 2. LUỒNG CHUẨN: TRẢ ĐÚNG HẠN (0% penalty)
  // =========================================================================
  describe("2. Luồng chuẩn - Trả đúng hạn (0% penalty)", function () {
    it("2.1 Create → Approve → Handover → Return on-time", async function () {
      const id = loanId("standard_flow");
      const now = await time.latest();
      const dueDate = now + ONE_DAY * 3;

      // Bước 1: Tạo đơn
      await expect(
        contract.createLoan(
          id, EQUIPMENT_ID, STUDENT_ID, student.address,
          now, dueDate, DEPOSIT
        )
      ).to.emit(contract, "LoanCreated")
       .withArgs(id, EQUIPMENT_ID, STUDENT_ID, student.address, dueDate, DEPOSIT);

      let loan = await contract.getLoan(id);
      expect(loan.state).to.equal(State.Submitted);
      expect(loan.depositState).to.equal(Deposit.None);

      // Bước 2: Duyệt đơn
      await expect(contract.approveLoan(id))
        .to.emit(contract, "LoanApproved");

      loan = await contract.getLoan(id);
      expect(loan.state).to.equal(State.Approved);
      expect(await contract.activeEquipmentLoan(EQUIPMENT_ID)).to.equal(id);

      // Bước 3: Bàn giao
      await expect(contract.confirmHandover(id))
        .to.emit(contract, "HandoverConfirmed");

      loan = await contract.getLoan(id);
      expect(loan.state).to.equal(State.Active);
      expect(loan.depositState).to.equal(Deposit.Locked);
      expect(loan.actualHandover).to.be.gt(0);
      expect(await contract.isOverdue(id)).to.be.false;

      // Bước 4: Trả đúng hạn (condition=0 TỐT, penalty=0 tự động)
      await expect(contract.confirmReturn(id, 0, 0))
        .to.emit(contract, "LoanReturned");

      loan = await contract.getLoan(id);
      expect(loan.state).to.equal(State.Returned);
      expect(loan.depositState).to.equal(Deposit.Refunded);
      expect(loan.penaltyPercent).to.equal(0);
      expect(loan.actualReturn).to.be.gt(0);
      // Mutex được giải phóng
      expect(await contract.activeEquipmentLoan(EQUIPMENT_ID))
        .to.equal(ethers.ZeroHash);
    });
  });

  // =========================================================================
  // 3. QUY TẮC PHẠT QUÁ HẠN
  // =========================================================================
  describe("3. Quy tắc phạt quá hạn", function () {
    let id, dueDate;

    beforeEach(async function () {
      id = loanId("overdue_base");
      const now = await time.latest();
      dueDate = now + ONE_DAY; // Due trong 1 ngày

      await contract.createLoan(
        id, EQUIPMENT_ID, STUDENT_ID, student.address,
        now, dueDate, DEPOSIT
      );
      await contract.approveLoan(id);
      await contract.confirmHandover(id);
    });

    it("3.1 Trễ ≤ 24h → phạt 10%, cọc hoàn trả", async function () {
      // Tua đến 12 giờ sau hạn
      await time.increaseTo(dueDate + 12 * 3600);
      expect(await contract.isOverdue(id)).to.be.true;

      // Kiểm tra hàm calculatePenalty
      const calc = await contract.calculatePenalty(id, 0);
      expect(calc.penalty).to.equal(10);
      expect(calc.depState).to.equal(Deposit.Refunded);
      expect(calc.nextState).to.equal(State.Returned);

      // Xác nhận trả
      await contract.confirmReturn(id, 0, 0);
      const loan = await contract.getLoan(id);
      expect(loan.penaltyPercent).to.equal(10);
      expect(loan.state).to.equal(State.Returned);
      expect(loan.depositState).to.equal(Deposit.Refunded);
    });

    it("3.2 Trễ > 24h → phạt 50%, cọc hoàn trả", async function () {
      // Tua đến 36 giờ sau hạn
      await time.increaseTo(dueDate + 36 * 3600);
      expect(await contract.isOverdue(id)).to.be.true;

      const calc = await contract.calculatePenalty(id, 0);
      expect(calc.penalty).to.equal(50);

      await contract.confirmReturn(id, 0, 0);
      const loan = await contract.getLoan(id);
      expect(loan.penaltyPercent).to.equal(50);
      expect(loan.state).to.equal(State.Returned);
    });
  });

  // =========================================================================
  // 4. THIẾT BỊ HỎNG / MẤT → TỊCH THU 100% CỌC
  // =========================================================================
  describe("4. Hỏng / Mất → Tịch thu 100% cọc", function () {
    it("4.1 HỎNG (condition=1) → penalty 100%, Forfeited, Disputed", async function () {
      const id = loanId("damaged");
      await advanceToActive(id);

      await contract.confirmReturn(id, 1, 0);
      const loan = await contract.getLoan(id);
      expect(loan.penaltyPercent).to.equal(100);
      expect(loan.depositState).to.equal(Deposit.Forfeited);
      expect(loan.state).to.equal(State.Disputed);
      expect(await contract.activeEquipmentLoan(EQUIPMENT_ID))
        .to.equal(ethers.ZeroHash);
    });

    it("4.2 MẤT (condition=2) → penalty 100%, Forfeited, Disputed", async function () {
      const id = loanId("lost");
      await advanceToActive(id);

      await contract.confirmReturn(id, 2, 0);
      const loan = await contract.getLoan(id);
      expect(loan.penaltyPercent).to.equal(100);
      expect(loan.depositState).to.equal(Deposit.Forfeited);
      expect(loan.state).to.equal(State.Disputed);
    });
  });

  // =========================================================================
  // 5. HỦY ĐƠN MƯỢN
  // =========================================================================
  describe("5. Hủy đơn mượn", function () {
    it("5.1 Hủy đơn ở trạng thái Submitted", async function () {
      const id = loanId("cancel_submitted");
      await createDefaultLoan(id);

      await expect(contract.cancelLoan(id, "Sinh viên đổi ý"))
        .to.emit(contract, "LoanCancelled");

      const loan = await contract.getLoan(id);
      expect(loan.state).to.equal(State.Cancelled);
    });

    it("5.2 Hủy đơn ở trạng thái Approved → giải phóng Mutex", async function () {
      const id = loanId("cancel_approved");
      await createDefaultLoan(id);
      await contract.approveLoan(id);

      // Xác nhận Mutex đã được đặt
      expect(await contract.activeEquipmentLoan(EQUIPMENT_ID)).to.equal(id);

      await contract.cancelLoan(id, "Thiết bị cần bảo trì");

      const loan = await contract.getLoan(id);
      expect(loan.state).to.equal(State.Cancelled);
      // Mutex đã được giải phóng
      expect(await contract.activeEquipmentLoan(EQUIPMENT_ID))
        .to.equal(ethers.ZeroHash);
    });

    it("5.3 KHÔNG thể hủy đơn đang Active", async function () {
      const id = loanId("cancel_active");
      await advanceToActive(id);

      await expect(
        contract.cancelLoan(id, "Thử hủy khi đang mượn")
      ).to.be.revertedWith("Cannot cancel active or closed loan");
    });

    it("5.4 KHÔNG thể hủy đơn đã Returned", async function () {
      const id = loanId("cancel_returned");
      await advanceToActive(id);
      await contract.confirmReturn(id, 0, 0);

      await expect(
        contract.cancelLoan(id, "Thử hủy khi đã trả")
      ).to.be.revertedWith("Cannot cancel active or closed loan");
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

      await contract.approveLoan(id1);

      // Đơn thứ 2 cho cùng thiết bị → bị từ chối
      await expect(contract.approveLoan(id2))
        .to.be.revertedWith("Equipment already active");
    });

    it("6.2 Cho phép duyệt đơn mới sau khi đơn cũ trả xong", async function () {
      const id1 = loanId("mutex_cycle_1");
      const id2 = loanId("mutex_cycle_2");

      // Hoàn thành đơn 1
      await advanceToActive(id1);
      await contract.confirmReturn(id1, 0, 0);

      // Đơn 2 cho cùng thiết bị → OK
      await createDefaultLoan(id2, { studentId: "SV2026002" });
      await expect(contract.approveLoan(id2)).to.not.be.reverted;
      expect(await contract.activeEquipmentLoan(EQUIPMENT_ID)).to.equal(id2);
    });

    it("6.3 Cho phép duyệt đơn mới sau khi đơn cũ bị hủy", async function () {
      const id1 = loanId("mutex_cancel_1");
      const id2 = loanId("mutex_cancel_2");

      await createDefaultLoan(id1);
      await contract.approveLoan(id1);
      await contract.cancelLoan(id1, "Hủy bỏ");

      // Đơn 2 cho cùng thiết bị → OK
      await createDefaultLoan(id2, { studentId: "SV2026002" });
      await expect(contract.approveLoan(id2)).to.not.be.reverted;
    });
  });

  // =========================================================================
  // 7. KIỂM TRA TRÙNG LOAN ID
  // =========================================================================
  describe("7. Kiểm tra trùng Loan ID", function () {
    it("7.1 Từ chối tạo đơn có ID trùng", async function () {
      const id = loanId("dup_id");
      await createDefaultLoan(id);

      const now = await time.latest();
      await expect(
        contract.createLoan(
          id, 999, "SV999", student.address,
          now, now + ONE_DAY, DEPOSIT
        )
      ).to.be.revertedWith("Loan ID already exists");
    });
  });

  // =========================================================================
  // 8. KIỂM TRA CHUYỂN TRẠNG THÁI KHÔNG HỢP LỆ (REVERT)
  // =========================================================================
  describe("8. Chuyển trạng thái không hợp lệ", function () {
    it("8.1 Không thể bàn giao đơn chưa duyệt (Submitted)", async function () {
      const id = loanId("handover_no_approve");
      await createDefaultLoan(id);

      await expect(contract.confirmHandover(id))
        .to.be.revertedWith("Loan not approved");
    });

    it("8.2 Không thể trả thiết bị khi đơn chưa Active", async function () {
      const id = loanId("return_no_active");
      await createDefaultLoan(id);
      await contract.approveLoan(id);

      await expect(contract.confirmReturn(id, 0, 0))
        .to.be.revertedWith("Loan is not active");
    });

    it("8.3 Không thể duyệt lại đơn đã Approved", async function () {
      const id = loanId("double_approve");
      await createDefaultLoan(id);
      await contract.approveLoan(id);

      await expect(contract.approveLoan(id))
        .to.be.revertedWith("Invalid state transition");
    });

    it("8.4 Không thể thao tác trên loanId không tồn tại", async function () {
      const fakeId = loanId("nonexistent");

      await expect(contract.approveLoan(fakeId))
        .to.be.revertedWith("Loan does not exist");
      await expect(contract.confirmHandover(fakeId))
        .to.be.revertedWith("Loan does not exist");
      await expect(contract.confirmReturn(fakeId, 0, 0))
        .to.be.revertedWith("Loan does not exist");
      await expect(contract.cancelLoan(fakeId, "test"))
        .to.be.revertedWith("Loan does not exist");
    });

    it("8.5 Từ chối loanId = bytes32(0)", async function () {
      const now = await time.latest();
      await expect(
        contract.createLoan(
          ethers.ZeroHash, EQUIPMENT_ID, STUDENT_ID,
          student.address, now, now + ONE_DAY, DEPOSIT
        )
      ).to.be.revertedWith("Invalid loan ID");
    });

    it("8.6 Từ chối dueDate <= expectedHandover", async function () {
      const id = loanId("bad_dates");
      const now = await time.latest();
      await expect(
        contract.createLoan(
          id, EQUIPMENT_ID, STUDENT_ID, student.address,
          now + ONE_DAY, now, DEPOSIT // dueDate < expectedHandover
        )
      ).to.be.revertedWith("Due date must be after handover");
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

    it("9.2 isOverdue trả false khi chưa quá hạn", async function () {
      const id = loanId("not_overdue");
      await advanceToActive(id);
      expect(await contract.isOverdue(id)).to.be.false;
    });

    it("9.3 isOverdue trả true khi đã quá hạn", async function () {
      const id = loanId("is_overdue");
      const now = await time.latest();
      const dueDate = now + ONE_DAY;

      await createDefaultLoan(id, { dueDate });
      await contract.approveLoan(id);
      await contract.confirmHandover(id);

      // Tua thời gian qua hạn
      await time.increaseTo(dueDate + 1);
      expect(await contract.isOverdue(id)).to.be.true;
    });

    it("9.4 calculatePenalty cho kết quả đúng với từng condition", async function () {
      const id = loanId("calc_penalty");
      await advanceToActive(id);

      // Condition 0 (TỐT) + chưa quá hạn → 0%
      let result = await contract.calculatePenalty(id, 0);
      expect(result.penalty).to.equal(0);

      // Condition 1 (HỎNG) → 100%
      result = await contract.calculatePenalty(id, 1);
      expect(result.penalty).to.equal(100);
      expect(result.depState).to.equal(Deposit.Forfeited);

      // Condition 2 (MẤT) → 100%
      result = await contract.calculatePenalty(id, 2);
      expect(result.penalty).to.equal(100);
    });
  });

  // =========================================================================
  // 10. EDGE CASES & THIẾT BỊ KHÔNG CỌC
  // =========================================================================
  describe("10. Edge cases", function () {
    it("10.1 Thiết bị không có cọc (deposit=0) → depositState giữ None", async function () {
      const id = loanId("no_deposit");
      await advanceToActive(id, { depositAmount: 0 });

      const loan = await contract.getLoan(id);
      expect(loan.depositAmount).to.equal(0);
      expect(loan.depositState).to.equal(Deposit.None); // Không chuyển sang Locked
    });

    it("10.2 Nhiều thiết bị khác nhau có thể mượn đồng thời", async function () {
      const id1 = loanId("multi_eq_1");
      const id2 = loanId("multi_eq_2");

      await createDefaultLoan(id1, { equipmentId: 101 });
      await createDefaultLoan(id2, { equipmentId: 202 });

      await contract.approveLoan(id1);
      await contract.approveLoan(id2);

      expect(await contract.activeEquipmentLoan(101)).to.equal(id1);
      expect(await contract.activeEquipmentLoan(202)).to.equal(id2);
    });

    it("10.3 Override penalty thủ công hoạt động đúng", async function () {
      const id = loanId("manual_penalty");
      await advanceToActive(id);

      // Trả với penalty thủ công = 25%
      await contract.confirmReturn(id, 0, 25);
      const loan = await contract.getLoan(id);
      expect(loan.penaltyPercent).to.equal(25);
      expect(loan.state).to.equal(State.Returned);
    });
  });
});
