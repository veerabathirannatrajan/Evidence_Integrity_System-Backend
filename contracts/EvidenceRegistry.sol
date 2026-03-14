// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * EvidenceRegistry
 * Stores SHA-256 hashes of digital evidence on the Polygon blockchain.
 * Once a hash is registered it cannot be changed — providing immutable proof
 * of the file's state at upload time.
 */
contract EvidenceRegistry {

    // ─── Data ──────────────────────────────────────────────────────────────

    struct EvidenceRecord {
        string  hash;
        address registeredBy;
        uint256 timestamp;
        bool    exists;
    }

    // evidenceId (MongoDB ObjectId string) → record
    mapping(string => EvidenceRecord) private records;

    // ─── Events ────────────────────────────────────────────────────────────

    event EvidenceRegistered(
        string indexed evidenceId,
        string hash,
        address registeredBy,
        uint256 timestamp
    );

    // ─── Functions ─────────────────────────────────────────────────────────

    /**
     * Register a new evidence hash.
     * @param evidenceId  MongoDB _id of the evidence document
     * @param hash        SHA-256 hex string of the file
     */
    function registerEvidence(
        string memory evidenceId,
        string memory hash
    ) public {
        require(!records[evidenceId].exists, "Evidence already registered");

        records[evidenceId] = EvidenceRecord({
            hash:         hash,
            registeredBy: msg.sender,
            timestamp:    block.timestamp,
            exists:       true
        });

        emit EvidenceRegistered(evidenceId, hash, msg.sender, block.timestamp);
    }

    /**
     * Verify an evidence hash against what was registered.
     * @param evidenceId  MongoDB _id of the evidence document
     * @param hash        SHA-256 hash to check
     * @return valid      true if hash matches the registered value
     * @return timestamp  Unix timestamp of registration (0 if not found)
     */
    function verifyEvidence(
        string memory evidenceId,
        string memory hash
    ) public view returns (bool valid, uint256 timestamp) {
        EvidenceRecord memory rec = records[evidenceId];
        if (!rec.exists) return (false, 0);

        bool match_ = keccak256(bytes(rec.hash)) == keccak256(bytes(hash));
        return (match_, rec.timestamp);
    }

    /**
     * Fetch the stored record for an evidence ID.
     */
    function getRecord(string memory evidenceId)
        public view
        returns (string memory hash, address registeredBy, uint256 timestamp, bool exists)
    {
        EvidenceRecord memory rec = records[evidenceId];
        return (rec.hash, rec.registeredBy, rec.timestamp, rec.exists);
    }
}
