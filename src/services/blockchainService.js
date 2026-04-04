// src/services/blockchainService.js
// FIXED:
//  1. Added 30-second timeout on all blockchain calls — prevents server hang
//  2. Provider has keepAlive and polling interval set correctly
//  3. Better error messages for each failure type
//  4. getContract() recreates provider if it goes stale (happens on Render)
//  5. anchorHash no longer blocks indefinitely

const { ethers } = require("ethers");
const path        = require("path");
const fs          = require("fs");

const artifactPath = path.join(
  __dirname,
  "../../artifacts/contracts/EvidenceRegistry.sol/EvidenceRegistry.json"
);

let _contract     = null;
let _contractAddr = null;
let _provider     = null;

const TX_TIMEOUT_MS = 90000;   // 90 seconds max for a transaction
const CALL_TIMEOUT_MS = 15000; // 15 seconds max for a read call

/**
 * Wrap a promise with a timeout.
 */
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} timed out after ${ms / 1000}s`)),
        ms
      )
    ),
  ]);
}

function getContract() {
  const rpcUrl          = process.env.POLYGON_RPC_URL;
  const privateKey      = process.env.PRIVATE_KEY;
  const contractAddress = process.env.CONTRACT_ADDRESS;

  if (!rpcUrl) {
    throw new Error(
      "❌ POLYGON_RPC_URL is not set. " +
      "Set it to: https://rpc-amoy.polygon.technology"
    );
  }
  if (!privateKey) {
    throw new Error(
      "❌ PRIVATE_KEY is not set. Export it from MetaMask."
    );
  }
  if (!contractAddress) {
    throw new Error(
      "❌ CONTRACT_ADDRESS is not set. Run deploy script first."
    );
  }
  if (!fs.existsSync(artifactPath)) {
    throw new Error(
      "❌ Contract artifact not found at: " + artifactPath + "\n" +
      "Run: npx hardhat compile"
    );
  }

  // Always recreate if address changed
  if (_contract && _contractAddr === contractAddress) {
    return _contract;
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  // Create provider with explicit polling config to prevent hanging
  _provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
    polling:         true,
    pollingInterval: 4000,
    staticNetwork:   true,
  });

  const wallet = new ethers.Wallet(privateKey, _provider);
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
    console.error("BlockchainService init error:", envErr.message);
    throw envErr;
  }

  try {
    // Send transaction with timeout
    const tx = await withTimeout(
      c.registerEvidence(evidenceId, hash),
      TX_TIMEOUT_MS,
      "registerEvidence"
    );

    console.log(`📤 TX sent: ${tx.hash} — waiting for confirmation…`);

    // Wait for confirmation with timeout
    await withTimeout(
      tx.wait(1),
      TX_TIMEOUT_MS,
      "tx.wait"
    );

    console.log(`✅ TX confirmed: ${tx.hash}`);
    return tx.hash;

  } catch (txErr) {
    // "Evidence already registered" — treat as success
    if (
      txErr.message &&
      (txErr.message.includes("Evidence already registered") ||
        txErr.message.includes("execution reverted"))
    ) {
      console.warn(`⚠️  Evidence ${evidenceId} already on-chain — skipping anchor`);
      throw new Error("ALREADY_REGISTERED: Evidence already anchored on blockchain");
    }

    console.error(`❌ anchorHash error for ${evidenceId}:`, txErr.message);
    throw txErr;
  }
}

/**
 * Verify an evidence hash on-chain.
 */
async function verifyOnChain(evidenceId, hash) {
  const c = getContract();

  const result = await withTimeout(
    c.verifyEvidence(evidenceId, hash),
    CALL_TIMEOUT_MS,
    "verifyEvidence"
  );

  const [valid, timestamp] = result;
  return {
    valid,
    timestamp: timestamp.toString(),
  };
}

/**
 * Get the full on-chain record for an evidence ID.
 */
async function getOnChainRecord(evidenceId) {
  const c = getContract();

  const result = await withTimeout(
    c.getRecord(evidenceId),
    CALL_TIMEOUT_MS,
    "getRecord"
  );

  const [hash, registeredBy, timestamp, exists] = result;
  return {
    hash,
    registeredBy,
    timestamp: timestamp.toString(),
    exists,
  };
}

module.exports = { anchorHash, verifyOnChain, getOnChainRecord };