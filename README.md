<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=200&section=header&text=EvidenceChain&fontSize=70&fontColor=fff&animation=twinkling&fontAlignY=35&desc=Blockchain-Powered%20Digital%20Evidence%20Integrity%20System&descAlignY=55&descSize=18" width="100%"/>

<br/>

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.x-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://mongodb.com)
[![Firebase](https://img.shields.io/badge/Firebase-Admin-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com)
[![Polygon](https://img.shields.io/badge/Polygon-Amoy_Testnet-8247E5?style=for-the-badge&logo=polygon&logoColor=white)](https://polygon.technology)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-363636?style=for-the-badge&logo=solidity&logoColor=white)](https://soliditylang.org)

<br/>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)
[![Render](https://img.shields.io/badge/Deployed_on-Render-46E3B7?style=flat-square&logo=render)](https://render.com)
[![Smart Contract](https://img.shields.io/badge/Contract-Polygon_Amoy-8247E5?style=flat-square)](https://amoy.polygonscan.com/address/0xac93065946CeADe04BD0233552177e33ea1dd651)

<br/>

> **Tamper-proof digital evidence management for law enforcement, forensic teams, prosecutors, defense attorneys, and court officials — anchored immutably on the Polygon blockchain.**

<br/>

[🚀 Live API](https://evidence-integrity-system-backend.onrender.com) &nbsp;·&nbsp; [📜 Smart Contract](https://amoy.polygonscan.com/address/0xac93065946CeADe04BD0233552177e33ea1dd651) &nbsp;·&nbsp; [📖 API Docs](#-api-reference) &nbsp;·&nbsp; [🐛 Report Bug](../../issues)

</div>

---

## 📋 Table of Contents

- [🎯 What is EvidenceChain?](#-what-is-evidencechain)
- [✨ Key Features](#-key-features)
- [🏗️ System Architecture](#️-system-architecture)
- [⚡ Full Evidence Flow](#-full-evidence-flow)
- [🛠️ Tech Stack](#️-tech-stack)
- [📁 Project Structure](#-project-structure)
- [🚀 Quick Start](#-quick-start)
- [⚙️ Environment Variables](#️-environment-variables)
- [🔗 Smart Contract](#-smart-contract)
- [📡 API Reference](#-api-reference)
- [🛡️ Role-Based Access](#️-role-based-access)
- [🔐 Authentication Flow](#-authentication-flow)
- [🚨 Tamper Detection](#-tamper-detection)
- [☁️ Deployment](#️-deployment)
- [🤝 Contributing](#-contributing)

---

## 🎯 What is EvidenceChain?

**EvidenceChain** is a production-grade backend system that brings **blockchain-level integrity** to digital evidence management. Every file uploaded is:

1. **Hashed** with SHA-256 cryptography
2. **Stored** securely in Firebase Storage
3. **Recorded** in MongoDB with full metadata
4. **Anchored** on the Polygon Amoy blockchain — creating an immutable, time-stamped proof
5. **Monitored** every 5 minutes by an automated tamper detection system

Any modification to the original file — even a single byte — is **immediately detected** and triggers real-time alerts via n8n automation (WhatsApp + Email).

---

## ✨ Key Features

<table>
<tr>
<td width="50%">

### 🔐 Immutable Blockchain Anchoring
Every evidence hash is written to the Polygon Amoy smart contract. Once registered, it cannot be altered — providing court-admissible proof of file integrity at the exact moment of upload.

</td>
<td width="50%">

### 🚨 Auto Tamper Detection
A background monitor runs every 5 minutes, re-verifying all anchored evidence against the blockchain. Any mismatch triggers instant n8n alerts via WhatsApp and Email.

</td>
</tr>
<tr>
<td width="50%">

### 👥 Role-Based Access Control
Five distinct roles — Police, Forensic, Prosecutor, Defense, Court — each with specific permissions enforced via Firebase custom claims.

</td>
<td width="50%">

### 🔗 Chain of Custody Tracking
Every evidence transfer is logged with a cryptographic hash snapshot, creating a complete, verifiable custody timeline from upload to court.

</td>
</tr>
<tr>
<td width="50%">

### 📊 Real-time Dashboard Stats
Live statistics for cases, evidence counts, blockchain anchor rates, and tamper alerts — all queryable via REST API.

</td>
<td width="50%">

### 🌐 Cross-Platform Ready
Built for a Flutter mobile/web app. Includes a Firebase Storage proxy endpoint that bypasses CORS for web deployments.

</td>
</tr>
</table>

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Flutter App (Client)                        │
│              Mobile  ·  Web  ·  Desktop                             │
└───────────────────────────┬─────────────────────────────────────────┘
                            │  HTTPS + Firebase ID Token
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Node.js / Express Backend                        │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ Auth         │  │ Evidence     │  │ Custody                  │  │
│  │ Middleware   │  │ Controller   │  │ Controller               │  │
│  │ (Firebase)   │  │              │  │                          │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────────────────┘  │
│         │                 │                                         │
│  ┌──────▼───────┐  ┌──────▼────────────────────────────────────┐   │
│  │ Firebase     │  │              Services Layer                │   │
│  │ Admin SDK    │  │                                            │   │
│  │ Token Verify │  │  hashService.js   → SHA-256               │   │
│  └──────────────┘  │  blockchainService → Polygon Amoy         │   │
│                    │  alertService      → n8n Webhook           │   │
│                    │  tamperMonitor     → Auto check (5 min)    │   │
│                    └───────────┬───────────────────────────────┘   │
└────────────────────────────────┼────────────────────────────────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          │                      │                      │
          ▼                      ▼                      ▼
┌─────────────────┐  ┌──────────────────┐  ┌──────────────────────┐
│   MongoDB Atlas │  │ Firebase Storage  │  │  Polygon Amoy Chain  │
│                 │  │                  │  │                      │
│ • Users         │  │ evidence/         │  │ EvidenceRegistry.sol │
│ • Cases         │  │  {caseId}/        │  │                      │
│ • Evidence      │  │   {file}          │  │ registerEvidence()   │
│ • Custody       │  │                  │  │ verifyEvidence()     │
└─────────────────┘  └──────────────────┘  └──────────────────────┘
                                                        │
                                            ┌──────────▼───────────┐
                                            │    n8n Automation    │
                                            │                      │
                                            │  📱 WhatsApp Alert   │
                                            │  📧 Email Alert      │
                                            └──────────────────────┘
```

---

## ⚡ Full Evidence Flow

```
 UPLOAD                    BLOCKCHAIN                   MONITOR
────────                  ────────────                 ─────────

1. Flutter uploads file
        ↓
2. Multer reads into buffer
        ↓
3. SHA-256 hash computed ──────────────────────────────► Stored in MongoDB
        ↓
4. File → Firebase Storage
        ↓
5. Evidence record saved                                 Every 5 min:
   to MongoDB (pending)                                  ┌──────────────┐
        ↓                                                │ verifyOnChain│
6. anchorHash() called ──► registerEvidence()            │ for all      │
        ↓                  on Polygon Amoy               │ anchored     │
7. tx.wait() — 1 confirm         ↓                      │ evidence     │
        ↓                  Hash immutably stored         │      ↓       │
8. MongoDB updated         on blockchain                 │ Mismatch?    │
   (anchored + txHash)                                   │      ↓       │
        ↓                                                │ 🚨 Alert!    │
9. Response returned to Flutter                          └──────────────┘

 VERIFY (Manual)
─────────────────
1. User re-uploads same file
        ↓
2. New SHA-256 computed
        ↓
3. Compare with stored hash  ── Match? ──► ✅ VERIFIED
        ↓
   No match
        ↓
4. verifyOnChain() — double-check blockchain
        ↓
5. isTampered = true saved to MongoDB
        ↓
6. sendTamperAlert() → n8n → WhatsApp + Email
        ↓
7. ⚠️ TAMPERED response returned
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Runtime** | Node.js 18+ | Server runtime |
| **Framework** | Express.js 4.x | REST API routing |
| **Database** | MongoDB Atlas + Mongoose | Evidence & user data |
| **Auth** | Firebase Admin SDK | JWT token verification + custom role claims |
| **Storage** | Firebase Storage | Encrypted file storage |
| **Blockchain** | Polygon Amoy (testnet) + ethers.js v6 | Immutable hash anchoring |
| **Smart Contract** | Solidity 0.8.20 + Hardhat | `EvidenceRegistry.sol` |
| **File Upload** | Multer (memoryStorage) | In-memory buffer for hashing |
| **Hashing** | Node.js `crypto` (SHA-256) | File fingerprinting |
| **Alerts** | n8n webhooks | Tamper notifications |
| **Deployment** | Render.com | Production hosting |

---

## 📁 Project Structure

```
evidence-backend/
│
├── 📜 contracts/
│   └── EvidenceRegistry.sol      ← Solidity smart contract
│
├── 🚀 scripts/
│   └── deploy.js                 ← Hardhat deploy to Polygon Amoy
│
├── ⚙️ src/
│   ├── config/
│   │   ├── db.js                 ← MongoDB connection
│   │   └── firebase.js           ← Firebase Admin + Storage bucket
│   │
│   ├── models/
│   │   ├── User.js               ← Firebase UID + role
│   │   ├── Case.js               ← Investigation case
│   │   ├── Evidence.js           ← File + hash + blockchain status
│   │   └── Custody.js            ← Transfer chain record
│   │
│   ├── controllers/
│   │   ├── userController.js     ← Create user, set Firebase claims
│   │   ├── caseController.js     ← CRUD for cases
│   │   ├── evidenceController.js ← Upload, verify, anchor, retry
│   │   └── custodyController.js  ← Transfer + history
│   │
│   ├── services/
│   │   ├── hashService.js        ← SHA-256 from buffer
│   │   ├── blockchainService.js  ← anchorHash, verifyOnChain
│   │   ├── alertService.js       ← n8n webhook trigger
│   │   └── tamperMonitor.js      ← Auto 5-minute check
│   │
│   ├── routes/
│   │   ├── userRoutes.js
│   │   ├── caseRoutes.js
│   │   ├── evidenceRoutes.js
│   │   └── custodyRoutes.js
│   │
│   ├── middleware/
│   │   └── authMiddleware.js     ← Firebase token verify
│   │
│   ├── app.js                    ← Express app setup
│   └── server.js                 ← Entry point
│
├── 📋 hardhat.config.js
├── 📋 vercel.json                ← Optional Vercel config
├── 📋 package.json
└── 📋 .env.example
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- MongoDB Atlas account (free tier works)
- Firebase project with Auth + Storage enabled
- MetaMask wallet with Polygon Amoy test MATIC
- n8n instance (optional — for tamper alerts)

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/evidence-backend.git
cd evidence-backend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

```bash
cp .env.example .env
# Edit .env with your values (see Environment Variables section below)
```

### 4. Compile the smart contract

```bash
npx hardhat compile
```

> This generates `artifacts/contracts/EvidenceRegistry.sol/EvidenceRegistry.json`
> which the backend reads for the contract ABI.

### 5. Deploy the smart contract to Polygon Amoy

```bash
npx hardhat run scripts/deploy.js --network amoy
```

You'll see:
```
✅ EvidenceRegistry deployed to: 0x...
```

Copy that address into your `.env` as `CONTRACT_ADDRESS`.

### 6. Start the server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

Server output:
```
🚀 Server running on port 5000
✅ MongoDB Connected
✅ Firebase Admin initialized
📦 Storage bucket: evidence-system-xxxx.firebasestorage.app
🛡️  Tamper monitor started (every 5 minutes)
```

### 7. Test the health check

```bash
curl https://localhost:5000/
# → { "message": "Evidence Backend Running ✅", "version": "1.0.0" }
```

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory:

```env
# ─── Server ─────────────────────────────────────────────────
PORT=5000

# ─── MongoDB ────────────────────────────────────────────────
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/evidence_system

# ─── Firebase ───────────────────────────────────────────────
FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app

# ─── Blockchain (Polygon Amoy Testnet) ──────────────────────
POLYGON_RPC_URL=https://rpc-amoy.polygon.technology
PRIVATE_KEY=your_wallet_private_key_without_0x
CONTRACT_ADDRESS=0xYourDeployedContractAddress

# ─── n8n Automation (optional) ──────────────────────────────
N8N_WEBHOOK_URL=https://your-n8n.app.n8n.cloud/webhook/tamper-alert
```

<details>
<summary><b>📋 Where to get each value</b></summary>

| Variable | Where to find it |
|---|---|
| `MONGO_URI` | MongoDB Atlas → Clusters → Connect → Drivers |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Firebase Console → Project Settings → Service Accounts → Generate new private key |
| `FIREBASE_STORAGE_BUCKET` | Firebase Console → Storage → copy the bucket name |
| `POLYGON_RPC_URL` | Use `https://rpc-amoy.polygon.technology` (public, no key needed) |
| `PRIVATE_KEY` | MetaMask → Account Details → Export Private Key |
| `CONTRACT_ADDRESS` | Output from `npx hardhat run scripts/deploy.js --network amoy` |
| `N8N_WEBHOOK_URL` | n8n → New Workflow → Webhook node → copy the URL |

</details>

<details>
<summary><b>🪙 Getting free Amoy test MATIC</b></summary>

You need test MATIC to pay for blockchain transactions (anchoring evidence hashes).

1. Go to **https://www.alchemy.com/faucets/polygon-amoy**
2. Create a free Alchemy account
3. Paste your MetaMask wallet address
4. Click **"Send Me MATIC"** — you'll receive 0.5 MATIC
5. That's enough for ~100+ evidence uploads

</details>

---

## 🔗 Smart Contract

### EvidenceRegistry.sol

The core smart contract deployed on **Polygon Amoy Testnet**.

```
Contract Address: 0xac93065946CeADe04BD0233552177e33ea1dd651
Network:          Polygon Amoy (Chain ID: 80002)
Explorer:         https://amoy.polygonscan.com/address/0xac93065946CeADe04BD0233552177e33ea1dd651
```

### Interface

```solidity
// Register a new evidence hash (called on every upload)
function registerEvidence(
    string memory evidenceId,   // MongoDB _id
    string memory hash          // SHA-256 hex string
) public

// Verify a hash against the registered value (called on verify)
function verifyEvidence(
    string memory evidenceId,
    string memory hash
) public view returns (bool valid, uint256 timestamp)

// Fetch the full on-chain record
function getRecord(
    string memory evidenceId
) public view returns (
    string memory hash,
    address registeredBy,
    uint256 timestamp,
    bool exists
)
```

### Key properties

- **Immutable** — once registered, a hash cannot be changed or deleted
- **Timestamped** — `block.timestamp` records the exact anchoring time
- **Unique** — registering the same `evidenceId` twice reverts with `"Evidence already registered"`
- **Gas efficient** — simple mapping storage, minimal computation

---

## 📡 API Reference

> All protected routes require `Authorization: Bearer <firebase_id_token>` header.

### 👤 Users

<details>
<summary><code>POST</code> <b>/api/user/create</b> — Create user & set role</summary>

**Body:**
```json
{
  "uid":   "firebase_uid_here",
  "name":  "Officer Ravi",
  "email": "ravi@police.gov.in",
  "role":  "police"
}
```

**Valid roles:** `police` | `forensic` | `prosecutor` | `defense` | `court`

**Response:**
```json
{
  "message": "User created successfully",
  "user": { "uid": "...", "name": "Officer Ravi", "email": "...", "role": "police" }
}
```

> Also sets Firebase custom claim `{ role: "police" }` and revokes existing tokens so the new role takes effect immediately.

</details>

<details>
<summary><code>GET</code> <b>/api/user/me</b> — Get current user profile</summary>

**Response:**
```json
{
  "uid":   "firebase_uid",
  "email": "ravi@police.gov.in",
  "role":  "police",
  "name":  "Officer Ravi"
}
```

</details>

---

### 📂 Cases

<details>
<summary><code>POST</code> <b>/api/cases</b> — Create new investigation case</summary>

**Body:**
```json
{
  "title":        "Robbery at Central Bank",
  "description":  "Armed robbery on 15 March 2025",
  "priority":     "high",
  "caseType":     "criminal",
  "location":     "42 Main Street, Chennai",
  "caseRef":      "CASE-2025-0042",
  "incidentDate": "2025-03-15T10:30:00Z"
}
```

**Valid priorities:** `low` | `medium` | `high` | `critical`  
**Valid types:** `criminal` | `civil` | `cyber` | `fraud` | `narcotics` | `other`

</details>

<details>
<summary><code>GET</code> <b>/api/cases</b> — Get all cases</summary>

Returns array of cases sorted by `createdAt` descending.

</details>

<details>
<summary><code>GET</code> <b>/api/cases/stats</b> — Dashboard statistics</summary>

**Response:**
```json
{
  "total": 12,
  "byStatus":   { "open": 8, "closed": 3, "underReview": 1 },
  "byPriority": { "low": 2, "medium": 5, "high": 4, "critical": 1 },
  "byType":     { "criminal": 7, "cyber": 3, "fraud": 2 }
}
```

</details>

<details>
<summary><code>PATCH</code> <b>/api/cases/:id</b> — Update case details</summary>

Supports partial updates — only include fields you want to change.

</details>

<details>
<summary><code>PATCH</code> <b>/api/cases/:id/status</b> — Update case status</summary>

**Body:** `{ "status": "closed" }`

</details>

---

### 🗂️ Evidence

<details>
<summary><code>POST</code> <b>/api/evidence/upload</b> — Upload evidence file 🔑</summary>

**Content-Type:** `multipart/form-data`

| Field | Type | Required |
|---|---|---|
| `file` | File | ✅ |
| `caseId` | String | ✅ |
| `description` | String | ❌ |
| `evidenceType` | String | ❌ auto-detected |

**Valid evidence types:** `image` | `video` | `audio` | `document` | `other`

**Response (anchored):**
```json
{
  "message":          "Evidence uploaded and anchored on blockchain",
  "evidenceId":       "69bcecab6b8fb6bd71f58926",
  "fileName":         "crime_scene.jpg",
  "fileHash":         "cf4bc1fb3a2e9f0d81c3b7...",
  "downloadURL":      "https://firebasestorage.googleapis.com/...",
  "blockchainStatus": "anchored",
  "blockchainTxHash": "0x1a2b3c4d..."
}
```

**Response (anchor failed — use retry):**
```json
{
  "message":          "Evidence uploaded — blockchain anchor failed, use POST /api/evidence/anchor/:id to retry",
  "evidenceId":       "...",
  "blockchainStatus": "failed",
  "blockchainTxHash": null
}
```

</details>

<details>
<summary><code>POST</code> <b>/api/evidence/anchor/:id</b> — Retry blockchain anchor 🔄</summary>

Call this when `blockchainStatus` is `"pending"` or `"failed"`.

**Response:**
```json
{
  "message":          "Anchored successfully",
  "evidenceId":       "...",
  "blockchainStatus": "anchored",
  "blockchainTxHash": "0x..."
}
```

If already anchored, returns the existing TX hash.

</details>

<details>
<summary><code>POST</code> <b>/api/evidence/verify</b> — Verify file integrity 🔍</summary>

**Content-Type:** `multipart/form-data`

| Field | Type | Required |
|---|---|---|
| `file` | File (same original file) | ✅ |
| `evidenceId` | String | ✅ |

**Response (clean):**
```json
{
  "status":           "VERIFIED",
  "message":          "Evidence integrity CONFIRMED",
  "evidenceId":       "...",
  "fileName":         "crime_scene.jpg",
  "hashMatch":        true,
  "blockchainValid":  true,
  "anchoredAt":       "2025-03-15T10:35:00Z",
  "blockchainTxHash": "0x..."
}
```

**Response (tampered):**
```json
{
  "status":        "TAMPERED",
  "message":       "Evidence integrity COMPROMISED",
  "originalHash":  "cf4bc1fb...",
  "newHash":       "9a2f44cc...",
  "hashMatch":     false,
  "blockchainValid": false,
  "dbUpdated":     true
}
```

> When tampered: `isTampered=true` is saved to MongoDB, and an n8n alert fires.

</details>

<details>
<summary><code>GET</code> <b>/api/evidence/stats</b> — Evidence statistics</summary>

```json
{
  "totalCases":    12,
  "totalEvidence": 47,
  "anchored":      44,
  "tampered":       1,
  "successRate":  "93.6"
}
```

</details>

<details>
<summary><code>GET</code> <b>/api/evidence/recent-activity</b> — Recent uploads + transfers</summary>

Returns `{ recentEvidence: [...], recentCustody: [...] }` — used for dashboard activity feeds.

</details>

<details>
<summary><code>GET</code> <b>/api/evidence/recent/:limit</b> — Recent evidence (for Blockchain Viewer)</summary>

Returns up to `:limit` most recent evidence records with full metadata.

</details>

<details>
<summary><code>GET</code> <b>/api/evidence/case/:caseId</b> — All evidence for a case</summary>

Returns array of evidence records sorted newest first, including `downloadURL`.

</details>

<details>
<summary><code>GET</code> <b>/api/evidence/image-proxy</b> — Firebase file proxy (CORS bypass)</summary>

```
GET /api/evidence/image-proxy?path=evidence/caseId/filename.jpg
```

Streams the file from Firebase Storage through the backend. Useful for web clients that cannot access Firebase Storage directly due to CORS.

**No auth required** — files are publicly readable in Storage.

</details>

<details>
<summary><code>GET</code> <b>/api/evidence/public/:id</b> — Public evidence (QR code scan)</summary>

No authentication required. Used by QR code links so anyone can verify an evidence record.

</details>

---

### 🔗 Chain of Custody

<details>
<summary><code>POST</code> <b>/api/custody/transfer</b> — Transfer evidence to another role</summary>

**Body:**
```json
{
  "evidenceId": "69bcecab6b8fb6bd71f58926",
  "toUser":     "firebase_uid_of_recipient",
  "toRole":     "forensic",
  "reason":     "Forwarding for forensic analysis",
  "notes":      "Handle with care — contains fragile media files"
}
```

> Transfer rules are enforced by role. See [Role-Based Access](#️-role-based-access).

</details>

<details>
<summary><code>GET</code> <b>/api/custody/history/:evidenceId</b> — Full custody chain</summary>

**Response:**
```json
{
  "evidence": {
    "id": "...", "fileName": "crime_scene.jpg",
    "blockchainStatus": "anchored", "isTampered": false
  },
  "chain": [
    { "type": "upload", "actor": "uid_police", "timestamp": "...", "txHash": "0x..." },
    { "type": "transfer", "fromRole": "police", "toRole": "forensic", "reason": "..." }
  ],
  "totalTransfers": 1,
  "currentCustodian": { "user": "uid_forensic", "role": "forensic" }
}
```

</details>

<details>
<summary><code>GET</code> <b>/api/custody/allowed-roles</b> — Roles current user can transfer to</summary>

```json
{
  "currentRole":  "police",
  "allowedRoles": [
    { "value": "forensic",   "label": "Forensic Expert" },
    { "value": "prosecutor", "label": "Prosecutor" }
  ]
}
```

</details>

---

## 🛡️ Role-Based Access

```
POLICE ──────────► FORENSIC ──────────► PROSECUTOR ──────► COURT
   │                                         │
   └──────────────────────────────► PROSECUTOR
                                        │
                                        └──────────► DEFENSE ──► COURT
```

| Role | Can Transfer To | Can Upload | Can Verify |
|---|---|---|---|
| 🚔 **Police** | Forensic, Prosecutor | ✅ | ✅ |
| 🔬 **Forensic** | Prosecutor, Court | ✅ | ✅ |
| ⚖️ **Prosecutor** | Court, Defense | ❌ | ✅ |
| 🛡️ **Defense** | Court | ❌ | ✅ |
| 🏛️ **Court** | — | ❌ | ✅ |

---

## 🔐 Authentication Flow

```
Flutter App                    Firebase Auth              Backend
──────────                     ─────────────              ───────

1. User logs in ──────────────► verifyPassword()
                               returns idToken ◄──────────────────
2. Call API ──── Bearer {idToken} ────────────────────────────────►
                                                 authMiddleware.js
                                                 verifyIdToken(token)
                                                 extracts: uid, role
                                                          ◄──────────
3. Response ◄────────────────────────────────────────────────────
```

**Custom Claims** — roles are stored as Firebase custom claims:
```javascript
// Set when user is created
admin.auth().setCustomUserClaims(uid, { role: "police" });

// Read in every request
decoded.role // → "police"
```

---

## 🚨 Tamper Detection

### Automatic Monitor (every 5 minutes)

```javascript
// tamperMonitor.js runs on server startup
startTamperMonitor();

// What it does:
1. Queries all evidence where blockchainStatus === "anchored" AND isTampered !== true
2. For each record, calls verifyOnChain(evidenceId, storedHash)
3. If blockchain returns valid=false → marks isTampered=true in MongoDB
4. Calls sendTamperAlert() → POSTs to n8n webhook
5. n8n sends WhatsApp message + Email notification
```

### n8n Alert Payload

```json
{
  "evidenceId":   "69bcecab6b8fb6bd71f58926",
  "fileName":     "crime_scene.jpg",
  "originalHash": "cf4bc1fb...",
  "newHash":      "9a2f44cc...",
  "detectedBy":   "system_monitor",
  "detectedAt":   "2025-03-20T06:43:36.695Z",
  "status":       "TAMPERED"
}
```

### Setting up n8n

1. Create a new workflow in n8n
2. Add a **Webhook** node → Method: POST → Path: `tamper-alert`
3. Copy the webhook URL → set as `N8N_WEBHOOK_URL` in `.env`
4. Add **Send Email** node for email alerts
5. Add **Twilio** node for WhatsApp alerts
6. **Activate** the workflow

---

## ☁️ Deployment

### Render.com (Recommended)

1. Push your code to GitHub
2. Go to [render.com](https://render.com) → New → **Web Service**
3. Connect your GitHub repo
4. Set build and start commands:

```
Build Command:  npm install && npx hardhat compile
Start Command:  npm start
```

5. Add all environment variables from your `.env`
6. Deploy!

> **Important:** The `artifacts/` folder must be generated at build time. The `npx hardhat compile` in the Build Command handles this automatically.

### Vercel (Alternative)

```json
// vercel.json
{
  "version": 2,
  "builds": [{ "src": "src/server.js", "use": "@vercel/node" }],
  "routes":  [{ "src": "/(.*)", "dest": "src/server.js" }],
  "functions": {
    "src/server.js": { "maxDuration": 60 }
  }
}
```

> ⚠️ Vercel serverless functions are killed after responding. The `maxDuration: 60` setting and synchronous `await anchorHash()` in the controller ensure anchoring completes before the response is sent.

---

## 🤝 Contributing

Contributions are welcome! Here's how:

1. **Fork** the repository
2. **Create** your feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** your changes: `git commit -m 'Add amazing feature'`
4. **Push** to the branch: `git push origin feature/amazing-feature`
5. **Open** a Pull Request

### Development Tips

```bash
# Run with auto-reload
npm run dev

# Compile smart contract
npm run compile

# Deploy contract to Amoy testnet
npm run deploy

# Test health check
curl http://localhost:5000/

# Test with a real token (replace with your Firebase ID token)
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:5000/api/user/me
```

---

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=100&section=footer" width="100%"/>

<br/>

**Built with ❤️ for tamper-proof evidence integrity**

[![GitHub stars](https://img.shields.io/github/stars/yourusername/evidence-backend?style=social)](https://github.com/yourusername/evidence-backend)
[![GitHub forks](https://img.shields.io/github/forks/yourusername/evidence-backend?style=social)](https://github.com/yourusername/evidence-backend)

*EvidenceChain — Where every byte of evidence is accounted for.*

</div>
