const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EquipmentLending Contract Skeleton", function () {
  let equipmentLending;
  let owner;
  let student;

  beforeEach(async function () {
    [owner, student] = await ethers.getSigners();
    const EquipmentLending = await ethers.getContractFactory("EquipmentLending");
    equipmentLending = await EquipmentLending.deploy(owner.address);
    await equipmentLending.waitForDeployment();
  });

  it("Should deploy successfully with correct initial owner", async function () {
    expect(await equipmentLending.owner()).to.equal(owner.address);
  });

  it("Should allow owner to create a skeleton loan record and emit LoanCreated", async function () {
    const loanId = ethers.keccak256(ethers.toUtf8Bytes("loan_demo_001"));
    const equipmentId = 101;
    const studentId = "SV2026001";
    const now = Math.floor(Date.now() / 1000);
    const dueDate = now + 86400 * 3;
    const depositAmount = 500000; // 500,000 VND simulated

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

    const loan = await equipmentLending.getLoan(loanId);
    expect(loan.studentId).to.equal(studentId);
    expect(loan.state).to.equal(0); // Submitted
  });
});
