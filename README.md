# Blockchain Evidence Integrity — Backend

Complete setup guide from zero to running.

---

## Project Structure

```
evidence-backend/
├── contracts/
│    └── EvidenceRegistry.sol       ← Solidity smart contract
├── scripts/
│    └── deploy.js                  ← Hardhat deploy script
├── src/
│   ├── config/
│   │    ├── db.js                  ← MongoDB connection
│   │    └── firebase.js            ← Firebase Admin init
│   ├── models/
│   │    ├── User.js
│   │    ├── Case.js
│   │    ├── Evidence.js
│   │    └── Custody.js
│   ├── controllers/
│   │    ├── userController.js
│   │    ├── caseController.js
│   │    ├── evidenceController.js
│   │    └── custodyController.js
│   ├── services/
│   │    ├── hashService.js         ← SHA-256 hashing
│   │    ├── blockchainService.js   ← Polygon anchoring
│   │    └── alertService.js        ← n8n tamper alerts
│   ├── routes/
│   │    ├── userRoutes.js
│   │    ├── caseRoutes.js
│   │    ├── evidenceRoutes.js
│   │    └── custodyRoutes.js
│   ├── middleware/
│   │    └── authMiddleware.js      ← Firebase token verification
│   ├── app.js
│   └── server.js
├── .env.example
├── .gitignore
├── hardhat.config.js
└── package.json
```

---

## STEP 1 — Install dependencies

```bash
npm install
```

---

## STEP 2 — Firebase setup

### 2a. Create Firebase project
1. Go to https://console.firebase.google.com
2. Click "Add project" → give it a name → Create
3. Go to **Authentication** → Get Started → enable **Email/Password**

### 2b. Download service account key
1. In Firebase Console → click the ⚙️ gear → **Project Settings**
2. Go to **Service Accounts** tab
3. Click **Generate new private key** → Download JSON
4. Rename it to `serviceAccountKey.json`
5. Place it in the **root** of your project (same level as package.json)
6. Make sure `.gitignore` has `serviceAccountKey.json` ← never commit this

---

## STEP 3 — MongoDB Atlas setup

1. Go to https://cloud.mongodb.com → create a free cluster
2. Click **Connect** → **Connect your application**
3. Copy the connection string — looks like:
   `mongodb+srv://username:password@cluster.mongodb.net/evidenceDB`
4. Save it for your `.env`

---

## STEP 4 — Create your .env file

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

```env
PORT=5000
MONGO_URI=mongodb+srv://youruser:yourpassword@cluster.mongodb.net/evidenceDB
FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
POLYGON_RPC_URL=https://rpc-mumbai.maticvigil.com
PRIVATE_KEY=your_metamask_private_key
CONTRACT_ADDRESS=                          ← fill this after Step 6
N8N_WEBHOOK_URL=https://your-n8n.com/webhook/tamper-alert
```

> ⚠️ PRIVATE_KEY is your MetaMask wallet private key.
> Export it from MetaMask → Account Details → Export Private Key.
> Never share this or commit it to GitHub.

---

## STEP 5 — Get test MATIC for Mumbai testnet

You need free test MATIC to pay for deploying the contract.

1. Open MetaMask → switch network to **Polygon Mumbai Testnet**
   (if not listed, add it: https://chainlist.org → search Mumbai)
2. Go to https://faucet.polygon.technology
3. Paste your wallet address → Request 0.5 MATIC
4. Wait ~30 seconds for it to arrive in your MetaMask

---

## STEP 6 — Compile and deploy the smart contract

### 6a. Compile
```bash
npx hardhat compile
```

You should see:
```
Compiled 1 Solidity file successfully
```

This creates `artifacts/contracts/EvidenceRegistry.sol/EvidenceRegistry.json`
The backend reads the ABI from this file automatically — don't delete it.

### 6b. Deploy to Mumbai testnet
```bash
npx hardhat run scripts/deploy.js --network mumbai
```

You should see:
```
Deploying EvidenceRegistry to Polygon Mumbai...
✅ EvidenceRegistry deployed to: 0xABC123...
```

### 6c. Save the contract address
Copy the deployed address and paste it into your `.env`:
```env
CONTRACT_ADDRESS=0xABC123...
```

### 6d. Verify on explorer (optional but recommended)
Go to https://mumbai.polygonscan.com and search your contract address.
You should see your deployment transaction.

---

## STEP 7 — n8n setup (tamper alerts)

### 7a. Install n8n (local)
```bash
npx n8n
```
Or use n8n cloud: https://app.n8n.io

### 7b. Create the workflow
1. Open n8n → **New Workflow**
2. Add node: **Webhook**
   - Method: POST
   - Path: `tamper-alert`
   - Copy the webhook URL → paste into `.env` as N8N_WEBHOOK_URL
3. Add node: **Send Email (SMTP)**
   - Connect your Gmail/SMTP credentials
   - Subject: `⚠️ Evidence Tampered — {{$json.evidenceId}}`
   - Body: `File: {{$json.fileName}} detected as tampered at {{$json.detectedAt}}`
4. (Optional) Add node: **Twilio** for WhatsApp alert
   - Message: `ALERT: Evidence {{$json.evidenceId}} has been tampered!`
5. **Activate** the workflow

---

## STEP 8 — Run the backend

```bash
npm run dev
```

You should see:
```
🚀 Server running on port 5000
✅ MongoDB Connected
✅ Firebase Admin initialized
```

---

## API Reference

### User

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/user/create | ✅ | Save user + set Firebase role claim |
| GET | /api/user/me | ✅ | Get current user profile |

**POST /api/user/create body:**
```json
{
  "uid": "firebase_uid_here",
  "name": "Officer Ravi",
  "email": "ravi@police.gov",
  "role": "police"
}
```

---

### Cases

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/cases | ✅ | Create a new case |
| GET | /api/cases | ✅ | Get all cases |
| GET | /api/cases/:id | ✅ | Get single case |

**POST /api/cases body:**
```json
{
  "title": "Case #2024-001",
  "description": "Armed robbery investigation"
}
```

---

### Evidence

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/evidence/upload | ✅ | Upload evidence file |
| POST | /api/evidence/verify | ✅ | Verify evidence integrity |
| GET | /api/evidence/case/:caseId | ✅ | All evidence for a case |
| GET | /api/evidence/:id | ✅ | Single evidence record |

**POST /api/evidence/upload** — form-data:
```
file     = <file>
caseId   = 65f1a2b3c4d5e6f7a8b9c0d1
```

**POST /api/evidence/verify** — form-data:
```
file        = <file>
evidenceId  = 65f1a2b3c4d5e6f7a8b9c0d2
```

**Verify response — clean:**
```json
{
  "status": "VERIFIED",
  "message": "✅ Evidence integrity verified",
  "hash": "cf4bc1fb...",
  "anchoredAt": "2024-03-01T10:30:00Z",
  "blockchain": { "valid": true, "timestamp": "1709288400" }
}
```

**Verify response — tampered:**
```json
{
  "status": "TAMPERED",
  "message": "⚠️ Evidence has been tampered!",
  "originalHash": "cf4bc1fb...",
  "newHash": "9a2f44cc...",
  "blockchain": { "valid": false, "timestamp": "1709288400" }
}
```

---

### Chain of Custody

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/custody/transfer | ✅ | Transfer evidence to another user |
| GET | /api/custody/history/:evidenceId | ✅ | Full custody timeline |

**POST /api/custody/transfer body:**
```json
{
  "evidenceId": "65f1a2b3c4d5e6f7a8b9c0d2",
  "toUser": "firebase_uid_of_receiver",
  "reason": "Sending to forensic lab for analysis"
}
```

---

### How to send requests from Flutter

Every request needs the Firebase ID token in the header:

```dart
final token = await FirebaseAuth.instance.currentUser!.getIdToken();

final response = await http.post(
  Uri.parse('http://your-server:5000/api/evidence/upload'),
  headers: {
    'Authorization': 'Bearer $token',
  },
  // body...
);
```

---

## How the full flow works

```
1. Flutter: user registers with Firebase Auth
        ↓
2. Flutter: calls POST /api/user/create  (sends uid + role)
        ↓
3. Backend: saves user to MongoDB + sets Firebase custom claim (role)
        ↓
4. Flutter: user logs in → Firebase returns ID token
        ↓
5. Flutter: uploads evidence file to POST /api/evidence/upload
        ↓
6. Backend: generates SHA-256 hash → saves to MongoDB (status: pending)
        ↓
7. Backend: anchors hash on Polygon → updates MongoDB (status: anchored, txHash)
        ↓
8. Flutter: calls POST /api/evidence/verify with same file later
        ↓
9. Backend: hashes file → compares with stored hash → checks blockchain
        ↓
10a. Match    → returns VERIFIED ✅
10b. Mismatch → returns TAMPERED ⚠️ + triggers n8n → WhatsApp + Email alert
```
