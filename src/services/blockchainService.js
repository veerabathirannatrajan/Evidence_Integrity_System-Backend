const { ethers } = require("ethers");
const path = require("path");
const fs = require("fs");

// ─── Load ABI from compiled artifact ────────────────────────────────────────
// This file is generated when you run: npx hardhat compile
const artifactPath = path.join(
  __dirname,
  "../../artifacts/contracts/EvidenceRegistry.sol/EvidenceRegistry.json"
);

let contract = null;

function getContract() {
  if (contract) return contract;

  if (!fs.existsSync(artifactPath)) {
    throw new Error(
      "Contract artifact not found. Run: npx hardhat compile"
    );
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
  const wallet   = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  contract = new ethers.Contract(
    process.env.CONTRACT_ADDRESS,
    artifact.abi,
    wallet
  );

  return contract;
}

/**
 * Anchor an evidence hash on the Polygon blockchain.
 * @param {string} evidenceId  - MongoDB _id of the evidence document
 * @param {string} hash        - SHA-256 hex string
 * @returns {string} transaction hash
 */
async function anchorHash(evidenceId, hash) {
  const c = getContract();
  const tx = await c.registerEvidence(evidenceId, hash);
  await tx.wait();           // wait for 1 confirmation
  return tx.hash;
}

/**
 * Verify an evidence hash on-chain.
 * @param {string} evidenceId
 * @param {string} hash
 * @returns {{ valid: boolean, timestamp: string }}
 */
async function verifyOnChain(evidenceId, hash) {
  const c = getContract();
  const [valid, timestamp] = await c.verifyEvidence(evidenceId, hash);
  return {
    valid,
    timestamp: timestamp.toString()   // BigInt → string
  };
}

/**
 * Get the full on-chain record for an evidence ID.
 * @param {string} evidenceId
 * @returns {{ hash, registeredBy, timestamp, exists }}
 */
async function getOnChainRecord(evidenceId) {
  const c = getContract();
  const [hash, registeredBy, timestamp, exists] = await c.getRecord(evidenceId);
  return {
    hash,
    registeredBy,
    timestamp: timestamp.toString(),
    exists
  };
}

module.exports = { anchorHash, verifyOnChain, getOnChainRecord };
