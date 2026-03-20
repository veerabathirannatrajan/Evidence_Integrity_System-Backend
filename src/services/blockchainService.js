// src/services/blockchainService.js
// FIXED:
//  1. Validates all required env vars before building contract instance
//  2. Clears cached contract if env vars change (important on Render)
//  3. Detailed error messages so you can see exactly what's missing in logs
//  4. getContract() no longer crashes the process — throws a clear Error instead

const { ethers } = require("ethers");
const path        = require("path");
const fs          = require("fs");

const artifactPath = path.join(
  __dirname,
  "../../artifacts/contracts/EvidenceRegistry.sol/EvidenceRegistry.json"
);

let _contract     = null;
let _contractAddr = null; // track which address we built the contract for

function getContract() {
  // ── Validate all required env vars ───────────────────────────────────────
  const rpcUrl          = process.env.POLYGON_RPC_URL;
  const privateKey      = process.env.PRIVATE_KEY;
  const contractAddress = process.env.CONTRACT_ADDRESS;

  if (!rpcUrl) {
    throw new Error(
      "❌ POLYGON_RPC_URL is not set. " +
      "Add it to Render → Environment → POLYGON_RPC_URL=https://rpc-amoy.polygon.technology"
    );
  }
  if (!privateKey) {
    throw new Error(
      "❌ PRIVATE_KEY is not set. " +
      "Add it to Render → Environment → PRIVATE_KEY=your_wallet_private_key"
    );
  }
  if (!contractAddress) {
    throw new Error(
      "❌ CONTRACT_ADDRESS is not set. " +
      "Add it to Render → Environment → CONTRACT_ADDRESS=0xac93065946CeADe04BD0233552177e33ea1dd651"
    );
  }

  // ── Check compiled artifact exists ───────────────────────────────────────
  if (!fs.existsSync(artifactPath)) {
    throw new Error(
      "❌ Contract artifact not found at: " + artifactPath + "\n" +
      "Run: npx hardhat compile — then commit the artifacts/ folder to git.\n" +
      "Or add it to Render as a Build Command: npm install && npx hardhat compile"
    );
  }

  // ── Re-create if address changed or not yet created ──────────────────────
  if (_contract && _contractAddr === contractAddress) {
    return _contract;
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet   = new ethers.Wallet(privateKey, provider);

  _contract     = new ethers.Contract(contractAddress, artifact.abi, wallet);
  _contractAddr = contractAddress;

  console.log(`✅ BlockchainService: contract loaded at ${contractAddress}`);
  return _contract;
}

/**
 * Anchor an evidence hash on the Polygon blockchain.
 * @param {string} evidenceId  - MongoDB _id of the evidence document
 * @param {string} hash        - SHA-256 hex string
 * @returns {string} transaction hash
 */
async function anchorHash(evidenceId, hash) {
  console.log(`⛓️  Anchoring evidence ${evidenceId} on Polygon Amoy…`);

  let c;
  try {
    c = getContract();
  } catch (envErr) {
    // Log clearly so you can see in Render logs
    console.error("BlockchainService init error:", envErr.message);
    throw envErr;
  }

  try {
    const tx = await c.registerEvidence(evidenceId, hash);
    console.log(`📤 TX sent: ${tx.hash} — waiting for confirmation…`);
    await tx.wait(); // wait for 1 block confirmation
    console.log(`✅ TX confirmed: ${tx.hash}`);
    return tx.hash;
  } catch (txErr) {
    // "Evidence already registered" means it was anchored before — treat as success
    if (txErr.message && txErr.message.includes("Evidence already registered")) {
      console.warn(`⚠️  Evidence ${evidenceId} already registered on-chain — skipping anchor`);
      // Return a placeholder so caller knows it's effectively anchored
      throw new Error("ALREADY_REGISTERED: Evidence already anchored on blockchain");
    }
    console.error(`❌ anchorHash tx error for ${evidenceId}:`, txErr.message);
    throw txErr;
  }
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
    timestamp: timestamp.toString(), // BigInt → string
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
    exists,
  };
}

module.exports = { anchorHash, verifyOnChain, getOnChainRecord };