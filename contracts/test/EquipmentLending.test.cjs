const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("EquipmentLending Contract - Comprehensive Lifecycle & Rules", function () {
  let equipmentLending;
  let owner;
  let student;
  let unauthorized;

  const equipmentId = 101;
  const studentId = "SV2026001";
  const depositAmount = 500000; // 500,000 VND simulated

  beforeEach(async function () {
    [owner, student, unauthorized] = await ethers.getSigners();
    const EquipmentLending = await ethers.getContractFactory("EquipmentLending");
    equipmentLending = await EquipmentLending.deploy(owner.address);
    await equipmentLending.waitForDeployment();
  });

  function getLoanId(suffix) {
    return ethers.keccak256(ethers.toUtf8Bytes(`loan_test_${suffix}`));
  }

  describe("1. Deployment & Ownership", function () {
    it("Should deploy with correct owner", async function () {
      expect(await equipmentLending.owner()).to.equal(owner.address);
    });

    it("Should reject non-owner transactions", async function () {
      const loanId = getLoanId("unauth");
      const now = await time.latest();
      await expect(
        equipmentLending.connect(unauthorized).createLoan(
          loanId,
          equipmentId,
          studentId,
          student.address,
          now,
          now + 86400,
          depositAmount
        )
      ).to.be.revertedWithCustomError(equipmentLending, "OwnableUnauthorizedAccount");
    });
  });

  describe("2. Full Standard Lifecycle (On-time Return)", function () {
    it("Should complete: Create -> Approve -> Handover -> Return on time (0% penalty)", async function () {
      const loanId = getLoanId("standard");
      const now = await time.latest();
      const dueDate = now + 86400 * 3; // 3 days

      // 1. Create
      await expect(
        equipmentLending.createLoan(
          loanId,
          equipmentId,
          studentId,
          student.address,
          now,
          dueDate,
          depositAmount
        )
      )
        .to.emit(equipmentLending, "LoanCreated")
        .withArgs(loanId, equipmentId, studentId, student.address, dueDate, depositAmount);

      let loan = await equipmentLending.getLoan(loanId);
      expect(loan.state).to.equal(0); // Submitted
      expect(loan.depositState).to.equal(0); // None

      // 2. Approve
      await expect(equipmentLending.approveLoan(loanId))
        .to.emit(equipmentLending, "LoanApproved")
        .withArgs(loanId, equipmentId, await time.latest() + 1);

      loan = await equipmentLending.getLoan(loanId);
      expect(loan.state).to.equal(1); // Approved
      expect(await equipmentLending.activeEquipmentLoan(equipmentId)).to.equal(loanId);

      // 3. Handover
      await expect(equipmentLending.confirmHandover(loanId))
        .to.emit(equipmentLending, "HandoverConfirmed");

      loan = await equipmentLending.getLoan(loanId);
      expect(loan.state).to.equal(2); // Active
      expect(loan.depositState).to.equal(1); // Locked
      expect(await equipmentLending.isOverdue(loanId)).to.be.false;

      // 4. Return (GOOD condition = 0, on time)
      await expect(equipmentLending.confirmReturn(loanId, 0, 0))
        .to.emit(equipmentLending, "LoanReturned");

      loan = await equipmentLending.getLoan(loanId);
      expect(loan.state).to.equal(3); // Returned
      expect(loan.depositState).to.equal(2); // Refunded
      expect(loan.penaltyPercent).to.equal(0);
      expect(await equipmentLending.activeEquipmentLoan(equipmentId)).to.equal(ethers.ZeroHash);
    });
  });

  describe("3. Overdue & Penalty Rules", function () {
    let loanId;
    let dueDate;

    beforeEach(async function () {
      loanId = getLoanId("overdue_setup");
      const now = await time.latest();
      dueDate = now + 86400; // 1 day

      await equipmentLending.createLoan(
        loanId,
        equipmentId,
        studentId,
        student.address,
        now,
        dueDate,
        depositAmount
      );
      await equipmentLending.approveLoan(loanId);
      await equipmentLending.confirmHandover(loanId);
    });

    it("Should calculate 10% penalty when returned <= 24h late", async function () {
      // Warp time to 12 hours after dueDate
      await time.increaseTo(dueDate + 12 * 3600);
      expect(await equipmentLending.isOverdue(loanId)).to.be.true;

      const penaltyInfo = await equipmentLending.calculatePenalty(loanId, 0);
      expect(penaltyInfo.penalty).to.equal(10);
      expect(penaltyInfo.depState).to.equal(2); // Refunded
      expect(penaltyInfo.nextState).to.equal(3); // Returned

      await equipmentLending.confirmReturn(loanId, 0, 0);
      const loan = await equipmentLending.getLoan(loanId);
      expect(loan.penaltyPercent).to.equal(10);
      expect(loan.state).to.equal(3); // Returned
      expect(loan.depositState).to.equal(2); // Refunded
    });

    it("Should calculate 50% penalty when returned > 24h late", async function () {
      // Warp time to 36 hours after dueDate
      await time.increaseTo(dueDate + 36 * 3600);
      expect(await equipmentLending.isOverdue(loanId)).to.be.true;

      const penaltyInfo = await equipmentLending.calculatePenalty(loanId, 0);
      expect(penaltyInfo.penalty).to.equal(50);

      await equipmentLending.confirmReturn(loanId, 0, 0);
      const loan = await equipmentLending.getLoan(loanId);
      expect(loan.penaltyPercent).to.equal(50);
      expect(loan.state).to.equal(3);
    });

    it("Should forfeit 100% deposit and set state to Disputed when DAMAGED", async function () {
      await equipmentLending.confirmReturn(loanId, 1, 0); // 1 = DAMAGED
      const loan = await equipmentLending.getLoan(loanId);
      expect(loan.penaltyPercent).to.equal(100);
      expect(loan.depositState).to.equal(3); // Forfeited
      expect(loan.state).to.equal(5); // Disputed
      expect(await equipmentLending.activeEquipmentLoan(equipmentId)).to.equal(ethers.ZeroHash);
    });

    it("Should forfeit 100% deposit and set state to Disputed when LOST", async function () {
      await equipmentLending.confirmReturn(loanId, 2, 0); // 2 = LOST
      const loan = await equipmentLending.getLoan(loanId);
      expect(loan.penaltyPercent).to.equal(100);
      expect(loan.depositState).to.equal(3); // Forfeited
      expect(loan.state).to.equal(5); // Disputed
    });
  });

  describe("4. Cancellation Scenarios", function () {
    it("Should allow cancelling a Submitted loan", async function () {
      const loanId = getLoanId("cancel_submitted");
      const now = await time.latest();
      await equipmentLending.createLoan(loanId, equipmentId, studentId, student.address, now, now + 86400, depositAmount);

      await expect(equipmentLending.cancelLoan(loanId, "Student changed mind"))
        .to.emit(equipmentLending, "LoanCancelled");

      const loan = await equipmentLending.getLoan(loanId);
      expect(loan.state).to.equal(4); // Cancelled
    });

    it("Should allow cancelling an Approved loan and release equipment mutex", async function () {
      const loanId = getLoanId("cancel_approved");
      const now = await time.latest();
      await equipmentLending.createLoan(loanId, equipmentId, studentId, student.address, now, now + 86400, depositAmount);
      await equipmentLending.approveLoan(loanId);
      expect(await equipmentLending.activeEquipmentLoan(equipmentId)).to.equal(loanId);

      await equipmentLending.cancelLoan(loanId, "Equipment maintenance required");

      const loan = await equipmentLending.getLoan(loanId);
      expect(loan.state).to.equal(4); // Cancelled
      expect(await equipmentLending.activeEquipmentLoan(equipmentId)).to.equal(ethers.ZeroHash);
    });

    it("Should reject cancelling an Active loan", async function () {
      const loanId = getLoanId("cancel_active");
      const now = await time.latest();
      await equipmentLending.createLoan(loanId, equipmentId, studentId, student.address, now, now + 86400, depositAmount);
      await equipmentLending.approveLoan(loanId);
      await equipmentLending.confirmHandover(loanId);

      await expect(
        equipmentLending.cancelLoan(loanId, "Try cancel active")
      ).to.be.revertedWith("Cannot cancel active or closed loan");
    });
  });

  describe("5. Concurrency & Mutex Validation", function () {
    it("Should prevent approving second loan for already active equipment", async function () {
      const loanId1 = getLoanId("eq_mutex_1");
      const loanId2 = getLoanId("eq_mutex_2");
      const now = await time.latest();

      await equipmentLending.createLoan(loanId1, equipmentId, studentId, student.address, now, now + 86400, depositAmount);
      await equipmentLending.createLoan(loanId2, equipmentId, "SV2026002", student.address, now, now + 86400, depositAmount);

      await equipmentLending.approveLoan(loanId1);

      // Attempt to approve loan2 for same equipment
      await expect(equipmentLending.approveLoan(loanId2)).to.be.revertedWith("Equipment already active");
    });

    it("Should allow new loan approval once previous loan is returned", async function () {
      const loanId1 = getLoanId("flow_1");
      const loanId2 = getLoanId("flow_2");
      const now = await time.latest();

      // Loan 1 full cycle
      await equipmentLending.createLoan(loanId1, equipmentId, studentId, student.address, now, now + 86400, depositAmount);
      await equipmentLending.approveLoan(loanId1);
      await equipmentLending.confirmHandover(loanId1);
      await equipmentLending.confirmReturn(loanId1, 0, 0);

      // Loan 2 should now succeed
      await equipmentLending.createLoan(loanId2, equipmentId, "SV2026002", student.address, now, now + 86400, depositAmount);
      await expect(equipmentLending.approveLoan(loanId2)).to.not.be.reverted;
      expect(await equipmentLending.activeEquipmentLoan(equipmentId)).to.equal(loanId2);
    });
  });

  describe("6. Edge Cases & Validations", function () {
    it("Should reject duplicate loanId", async function () {
      const loanId = getLoanId("duplicate_id");
      const now = await time.latest();
      await equipmentLending.createLoan(loanId, equipmentId, studentId, student.address, now, now + 86400, depositAmount);

      await expect(
        equipmentLending.createLoan(loanId, 999, "SV999", student.address, now, now + 86400, depositAmount)
      ).to.be.revertedWith("Loan ID already exists");
    });

    it("Should reject due date <= expected handover", async function () {
      const loanId = getLoanId("invalid_dates");
      const now = await time.latest();
      await expect(
        equipmentLending.createLoan(loanId, equipmentId, studentId, student.address, now + 86400, now, depositAmount)
      ).to.be.revertedWith("Due date must be after handover");
    });

    it("Should reject handover of unapproved loan", async function () {
      const loanId = getLoanId("unapproved_handover");
      const now = await time.latest();
      await equipmentLending.createLoan(loanId, equipmentId, studentId, student.address, now, now + 86400, depositAmount);

      await expect(equipmentLending.confirmHandover(loanId)).to.be.revertedWith("Loan not approved");
    });
  });
});
