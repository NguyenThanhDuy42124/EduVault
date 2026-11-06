import os

deploy_path = os.path.join(os.path.dirname(__file__), '..', 'contracts', 'scripts', 'deploy.cjs')
with open(deploy_path, 'r', encoding='utf-8') as f:
    content = f.read()

anchor = 'console.log(`Contract address exported: ${addressFilePath}`);'
if anchor in content and 'frontendContractsDir' not in content:
    replacement = anchor + """

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
    network: hre.network.name,
    chainId: deployInfo.chainId,
    deployedAt: deployInfo.deployedAt,
  }, null, 2));
  console.log(`Contract ABI & Address exported to frontend: ${frontendContractsDir}`);"""
    new_content = content.replace(anchor, replacement)
    with open(deploy_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("PATCHED_DEPLOY_CJS_SUCCESS")
else:
    print("ALREADY_PATCHED_OR_ANCHOR_NOT_FOUND")
