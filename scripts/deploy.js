// scripts/deploy.js
// Deploy EvidenceRegistry to Polygon Amoy Testnet (chainId 80002)
// Run: npx hardhat run scripts/deploy.js --network amoy

const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying EvidenceRegistry to Polygon Amoy Testnet...");
  console.log(`   Network: ${hre.network.name}`);

  const [deployer] = await hre.ethers.getSigners();
  console.log(`   Deployer address: ${deployer.address}`);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`   Deployer balance: ${hre.ethers.formatEther(balance)} MATIC`);

  if (balance === 0n) {
    throw new Error(
      "❌ Deployer wallet has 0 MATIC. " +
      "Get free Amoy test MATIC from https://faucet.polygon.technology"
    );
  }

  const EvidenceRegistry = await hre.ethers.getContractFactory("EvidenceRegistry");
  const contract = await EvidenceRegistry.deploy();

  await contract.waitForDeployment();

  const address = await contract.getAddress();

  console.log("");
  console.log("✅ EvidenceRegistry deployed successfully!");
  console.log(`   Contract address: ${address}`);
  console.log("");
  console.log("📋 Next steps:");
  console.log(`   1. Copy this address into your .env:`);
  console.log(`      CONTRACT_ADDRESS=${address}`);
  console.log(`   2. Also set it in Render Dashboard → Environment Variables`);
  console.log(`   3. Verify on Polygonscan Amoy:`);
  console.log(`      https://amoy.polygonscan.com/address/${address}`);
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exitCode = 1;
});