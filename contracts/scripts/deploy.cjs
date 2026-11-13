/**
 * Deploy Script: EquipmentLending Smart Contract
 *
 * Hỗ trợ deploy lên cả Hardhat local lẫn Sepolia Testnet.
 *
 * Cách dùng:
 *   Local:   npx hardhat node && npx hardhat run scripts/deploy.cjs --network localhost
 *   Sepolia: npx hardhat run scripts/deploy.cjs --network sepolia
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const networkName = hre.network.name;
  const isSepolia = networkName === "sepolia";

  console.log("=".repeat(60));
  console.log("  EduVault - Deploy EquipmentLending Contract");
  console.log(`  Network: ${networkName}`);
  console.log("=".repeat(60));

  // Lấy tài khoản deployer
  const [deployer] = await hre.ethers.getSigners();
  console.log(`\nDeployer (Admin Relayer): ${deployer.address}`);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Balance: ${hre.ethers.formatEther(balance)} ETH`);

  if (isSepolia && parseFloat(hre.ethers.formatEther(balance)) < 0.01) {
    console.error("\n❌ Số dư ETH không đủ để deploy lên Sepolia! Cần ít nhất 0.01 ETH.");
    console.error("   Lấy Sepolia ETH miễn phí tại: https://cloud.google.com/application/web3/faucet/ethereum/sepolia");
    process.exit(1);
  }

  // Deploy contract
  console.log("\nDeploying EquipmentLending...");
  const Factory = await hre.ethers.getContractFactory("EquipmentLending");
  const contract = await Factory.deploy(deployer.address);
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  const chainInfo = await hre.ethers.provider.getNetwork();
  const chainId = chainInfo.chainId.toString();

  console.log(`✅ Contract deployed at: ${contractAddress}`);
  if (isSepolia) {
    console.log(`   View on Etherscan: https://sepolia.etherscan.io/address/${contractAddress}`);
  }

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
    network: networkName,
    chainId: chainId,
    deployedAt: new Date().toISOString(),
    etherscanUrl: isSepolia ? `https://sepolia.etherscan.io/address/${contractAddress}` : null,
    abi: artifact.abi,
  };

  // --- Lưu vào thư mục contracts/deployments/ ---
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  const deployFileName = isSepolia ? "sepolia.json" : "localhost.json";
  const deployFilePath = path.join(deploymentsDir, deployFileName);
  fs.writeFileSync(deployFilePath, JSON.stringify(deployInfo, null, 2));
  console.log(`\nDeploy info saved: ${deployFilePath}`);

  // --- Export sang backend ---
  const backendContractsDir = path.join(
    __dirname, "..", "..", "backend", "app", "core", "contracts"
  );
  if (!fs.existsSync(backendContractsDir)) {
    fs.mkdirSync(backendContractsDir, { recursive: true });
  }

  const abiFilePath = path.join(backendContractsDir, "EquipmentLending.json");
  fs.writeFileSync(abiFilePath, JSON.stringify({
    contractName: "EquipmentLending",
    address: contractAddress,
    abi: artifact.abi,
  }, null, 2));
  console.log(`ABI exported to backend: ${abiFilePath}`);

  const addressFilePath = path.join(backendContractsDir, "contract_address.json");
  fs.writeFileSync(addressFilePath, JSON.stringify({
    EquipmentLending: contractAddress,
    network: networkName,
    chainId: chainId,
    deployedAt: deployInfo.deployedAt,
  }, null, 2));
  console.log(`Contract address exported: ${addressFilePath}`);

  // --- Export sang frontend ---
  const frontendContractsDir = path.join(
    __dirname, "..", "..", "frontend", "src", "contracts"
  );
  if (!fs.existsSync(frontendContractsDir)) {
    fs.mkdirSync(frontendContractsDir, { recursive: true });
  }
  const frontendAbiPath = path.join(frontendContractsDir, "EquipmentLending.json");
  fs.writeFileSync(frontendAbiPath, JSON.stringify({
    contractName: "EquipmentLending",
    address: contractAddress,
    abi: artifact.abi,
  }, null, 2));
  const frontendAddrPath = path.join(frontendContractsDir, "contract_address.json");
  fs.writeFileSync(frontendAddrPath, JSON.stringify({
    EquipmentLending: contractAddress,
    network: networkName,
    chainId: chainId,
    deployedAt: deployInfo.deployedAt,
  }, null, 2));
  console.log(`Contract ABI & Address exported to frontend: ${frontendContractsDir}`);

  // Tóm tắt
  console.log("\n" + "=".repeat(60));
  console.log("  DEPLOY THÀNH CÔNG!");
  console.log("=".repeat(60));
  console.log(`  Contract:  ${contractAddress}`);
  console.log(`  Network:   ${networkName} (chainId: ${chainId})`);
  console.log(`  Deployer:  ${deployer.address}`);
  if (isSepolia) {
    console.log(`  Etherscan: https://sepolia.etherscan.io/address/${contractAddress}`);
    console.log("\n  📝 Cập nhật backend/.env:");
    console.log(`     BLOCKCHAIN_RPC_URL=<your_sepolia_rpc_url>`);
    console.log(`     CHAIN_ID=11155111`);
    console.log(`     CONTRACT_ADDRESS=${contractAddress}`);
  }
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deploy failed:", error);
    process.exit(1);
  });
