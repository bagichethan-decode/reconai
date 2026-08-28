# ReconAI

## Payment Reconciliation Platform

ReconAI is a full-stack payment reconciliation platform that compares orders, payment settlements, and bank records to identify discrepancies and reconciliation exceptions.

It combines deterministic reconciliation rules, MySQL persistence, REST APIs, AI-powered explanations, and an interactive finance dashboard.

---

## Key Features

- Multi-source payment reconciliation
- Exact and fuzzy reference matching
- Amount and tolerance validation
- Fee-adjusted reconciliation
- Missing settlement and bank entry detection
- Exception classification with severity and confidence
- AI-generated explanations and suggested actions
- Search, filtering, sorting, and pagination
- Order-level reconciliation details
- CSV export
- REST API with input validation and error handling
- Automated unit and API integration tests
- GitHub Actions CI

---

## Exception Categories

| Category | Severity |
|---|---|
| `AMOUNT_MISMATCH` | HIGH |
| `MISSING_BANK` | HIGH |
| `NO_SETTLEMENT` | MEDIUM |
| `UNRESOLVED` | MEDIUM |
| `FUZZY_MATCH` | LOW |
| `FEE_ADJUSTED_MATCH` | — |

---

## Architecture

```text
Orders / Settlements / Bank Records
                │
                ▼
       Reconciliation Engine
                │
       ┌────────┴────────┐
       │ Matching &      │
       │ Validation Rules│
       └────────┬────────┘
                ▼
       Exception Classification
                │
                ▼
        AI Explanation Layer
                │
                ▼
        REST API + Dashboard
=======
Orders
   │
   ▼
Payment Settlements
   │
   ▼
Bank Transactions
   │
   ▼
Reconciliation Engine
   │
   ├── Exact Matching
   ├── Fee-Adjusted Matching
   ├── Fuzzy Matching
   ├── Amount Validation
   ├── Settlement Validation
   └── Bank Verification
   │
   ▼
Exception Classification
   │
   ▼
AI Explanation
   │
   ▼
Finance Dashboard
      fb8de73 (docs: add load testing results)
```

---

## Technology Stack

**Backend**
- Node.js
- Express
- MySQL
- mysql2

**Frontend**
- HTML5
- CSS3
- Vanilla JavaScript

**Data & Processing**
- CSV parsing
- String similarity matching
- Deterministic reconciliation rules

**Testing & CI**
- Node.js Test Runner
- Unit Tests
- API Integration Tests
- GitHub Actions

---

## REST API

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | API and database health |
| GET | `/api/reconciliation/summary` | Reconciliation metrics |
| GET | `/api/reconciliation/orders` | Orders and reconciliation data |
| GET | `/api/reconciliation/exceptions` | Exception records |
| GET | `/api/reconciliation/orders/:orderId` | Order reconciliation details |

---

## Testing

Run the complete test suite:

```bash
npm test
```

Current result:

```text
16 tests
16 passed
0 failed
```

The test suite covers reconciliation logic, API endpoints, validation, error handling, and exception classification.

---

## Project Structure

```text
ReconAI/
├── backend/
├── frontend/
├── data/
├── tests/
├── .github/
│   └── workflows/
├── .env.example
├── package.json
├── package-lock.json
├── schema.sql
└── README.md
```

---

## Getting Started

### 1. Clone

```bash
git clone https://github.com/bagichethan-decode/reconai.git
cd reconai
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

Create `.env` using `.env.example` and configure the required database and API credentials.

> Never commit `.env` or secret credentials.

### 4. Start the backend

```bash
npm start
```

API:

```text
http://localhost:3000
```

### 5. Start the frontend

```bash
npx serve frontend -l 5500
```

Open the local URL displayed by the command.

---

## Engineering Highlights

ReconAI demonstrates practical software engineering through:

- RESTful API design
- Database integration
- Input validation
- Error handling
- Reconciliation algorithms
- Automated testing
- Environment-based configuration
- Continuous integration
- Finance-focused operational workflows

---

## License

ISC
=======
## Performance Testing

ReconAI was load tested using k6 against the REST API.

Test configuration:

- Maximum virtual users: 50
- Test duration: 60 seconds
- Total HTTP requests: 5,464
- Throughput: 89.91 requests/second
- Average latency: 7.29 ms
- p95 latency: 24.37 ms
- Error rate: 0%
- Checks passed: 5,464 / 5,464

All configured performance thresholds passed successfully.

---
 fb8de73 (docs: add load testing results)
