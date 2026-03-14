const hre = require("hardhat");

async function main() {
  console.log("Deploying EvidenceRegistry to Polygon Mumbai...");

  const EvidenceRegistry = await hre.ethers.getContractFactory("EvidenceRegistry");
  const contract = await EvidenceRegistry.deploy();

  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("✅ EvidenceRegistry deployed to:", address);
  console.log("Copy this address into your .env as CONTRACT_ADDRESS=", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
