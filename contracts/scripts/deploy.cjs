/**
 * Deploy Script: EquipmentLending Smart Contract
 *
 * Triển khai contract lên Hardhat local network và lưu thông tin deploy
 * (địa chỉ contract, ABI) vào file JSON để backend/frontend sử dụng.
 *
 * Cách dùng:
 *   1. Chạy Hardhat node: npx hardhat node
 *   2. Deploy: npx hardhat run scripts/deploy.cjs --network localhost
 *   Hoặc deploy trên mạng tạm (in-process): npx hardhat run scripts/deploy.cjs
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("=".repeat(60));
  console.log("  EduVault - Deploy EquipmentLending Contract");
  console.log("=".repeat(60));

  // Lấy tài khoản deployer (Hardhat Account #0 = Admin Relayer)
  const [deployer] = await hre.ethers.getSigners();
  console.log(`\nDeployer (Admin Relayer): ${deployer.address}`);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Balance: ${hre.ethers.formatEther(balance)} ETH`);

  // Deploy contract
  console.log("\nDeploying EquipmentLending...");
  const Factory = await hre.ethers.getContractFactory("EquipmentLending");
  const contract = await Factory.deploy(deployer.address);
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log(`Contract deployed at: ${contractAddress}`);

  // Lấy ABI từ artifact
  const artifactPath = path.join(
    __dirname, "..", "artifacts", "contracts",
    "EquipmentLending.sol", "EquipmentLending.json"
  );
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));

  // Tạo thông tin deploy
  const deployInfo = {
    contractName: "EquipmentLending",
    address: contractAddress,
    deployer: deployer.address,
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployedAt: new Date().toISOString(),
    abi: artifact.abi,
  };

  // --- Lưu vào thư mục contracts/deployments/ ---
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  const deployFilePath = path.join(deploymentsDir, "localhost.json");
  fs.writeFileSync(deployFilePath, JSON.stringify(deployInfo, null, 2));
  console.log(`\nDeploy info saved: ${deployFilePath}`);

  // --- Export sang backend ---
  const backendContractsDir = path.join(
    __dirname, "..", "..", "backend", "app", "core", "contracts"
  );
  if (!fs.existsSync(backendContractsDir)) {
    fs.mkdirSync(backendContractsDir, { recursive: true });
  }

  // Lưu ABI riêng (backend chỉ cần ABI)
  const abiFilePath = path.join(backendContractsDir, "EquipmentLending.json");
  fs.writeFileSync(abiFilePath, JSON.stringify({
    contractName: "EquipmentLending",
    address: contractAddress,
    abi: artifact.abi,
  }, null, 2));
  console.log(`ABI exported to backend: ${abiFilePath}`);

  // Lưu địa chỉ contract vào file riêng (dễ đọc)
  const addressFilePath = path.join(backendContractsDir, "contract_address.json");
  fs.writeFileSync(addressFilePath, JSON.stringify({
    EquipmentLending: contractAddress,
    network: hre.network.name,
    chainId: deployInfo.chainId,
    deployedAt: deployInfo.deployedAt,
  }, null, 2));
  console.log(`Contract address exported: ${addressFilePath}`);

  // Tóm tắt
  console.log("\n" + "=".repeat(60));
  console.log("  DEPLOY THÀNH CÔNG!");
  console.log("=".repeat(60));
  console.log(`  Contract:  ${contractAddress}`);
  console.log(`  Network:   ${hre.network.name} (chainId: ${deployInfo.chainId})`);
  console.log(`  Deployer:  ${deployer.address}`);
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deploy failed:", error);
    process.exit(1);
  });
