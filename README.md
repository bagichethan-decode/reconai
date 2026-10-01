# ReconAI

### Payment Reconciliation Platform

<p align="center">
  <img src="docs/images/reconai-hero.png" alt="ReconAI 3D Payment Reconciliation Platform" width="100%">
</p>

<p align="center">
  <strong>ReconAI</strong> is a full-stack payment reconciliation platform that compares orders, payment settlements, and bank records to identify discrepancies, reconciliation exceptions, and settlement issues.
</p>

<p align="center">
  Deterministic reconciliation • AI explanations • REST APIs • MySQL • Finance Dashboard
</p>

---

## Overview

ReconAI is designed around a real-world financial operations workflow.

Payment information commonly exists across multiple systems:

```text
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
   ▼
Exception Classification
   │
   ▼
AI Explanation
   │
   ▼
Finance Dashboard
```

The platform brings these sources together, applies deterministic reconciliation rules, identifies exceptions, and presents the results through an operational finance dashboard.

---

## 3D System Overview

<p align="center">
  <img src="docs/images/reconai-architecture-3d.png"
       alt="ReconAI 3D System Architecture"
       width="95%">
</p>

The platform can be visualized as a financial data pipeline:

* **Orders** provide the expected transaction information.
* **Payment settlements** provide processor-side settlement records.
* **Bank transactions** provide actual financial movement.
* **Reconciliation Engine** compares and validates records.
* **Exception Classification** categorizes discrepancies.
* **AI Explanation Layer** explains detected issues.
* **Finance Dashboard** exposes actionable results.

---

## Key Features

* Multi-source payment reconciliation
* Exact reference matching
* Fuzzy reference matching
* Amount and tolerance validation
* Fee-adjusted reconciliation
* Missing settlement detection
* Missing bank entry detection
* Exception classification
* Severity and confidence tracking
* AI-generated explanations
* Suggested corrective actions
* Search and filtering
* Sorting and pagination
* Order-level reconciliation details
* CSV export
* REST API
* Input validation
* Error handling
* Automated unit testing
* API integration testing
* GitHub Actions CI
* Load testing with k6

---

## Reconciliation Engine

The core of ReconAI is a deterministic reconciliation engine.

<p align="center">
  <img src="docs/images/reconai-reconciliation-flow.png"
       alt="ReconAI Reconciliation Flow"
       width="90%">
</p>

The engine evaluates multiple signals before determining the reconciliation state.

### Matching Strategies

```text
                    ┌─────────────────────┐
                    │ Transaction Records │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
        Exact Match      Fuzzy Match     Fee-Adjusted
              │                │                │
              └────────────────┼────────────────┘
                               ▼
                     Amount Validation
                               │
                               ▼
                    Settlement Validation
                               │
                               ▼
                      Bank Verification
                               │
                               ▼
                    Exception Classification
```

---

## Exception Categories

| Category             | Severity |
| -------------------- | -------- |
| `AMOUNT_MISMATCH`    | HIGH     |
| `MISSING_BANK`       | HIGH     |
| `NO_SETTLEMENT`      | MEDIUM   |
| `UNRESOLVED`         | MEDIUM   |
| `FUZZY_MATCH`        | LOW      |
| `FEE_ADJUSTED_MATCH` | —        |

---

## Architecture

```text
┌──────────────────────┐
│       ORDERS         │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ PAYMENT SETTLEMENTS  │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   BANK TRANSACTIONS  │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────────────┐
│    RECONCILIATION ENGINE     │
│                              │
│  • Exact Matching            │
│  • Fuzzy Matching            │
│  • Fee-Adjusted Matching     │
│  • Amount Validation         │
│  • Settlement Validation     │
│  • Bank Verification         │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│   EXCEPTION CLASSIFICATION   │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│     AI EXPLANATION LAYER     │
│                              │
│  • Explanation               │
│  • Root Cause                │
│  • Suggested Action          │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│      FINANCE DASHBOARD       │
└──────────────────────────────┘
```

---

## Finance Dashboard

<p align="center">
  <img src="docs/images/reconai-dashboard.png"
       alt="ReconAI Finance Dashboard"
       width="95%">
</p>

The dashboard provides an operational view of reconciliation activity.

### Dashboard capabilities

* Total transactions
* Matched transactions
* Unmatched transactions
* Exception count
* High-severity exceptions
* Reconciliation status
* Exception filtering
* Order-level investigation
* Transaction search
* Settlement tracking
* Bank verification
* CSV export

---

## AI Explanation Layer

ReconAI separates **deterministic financial decisions** from AI-generated explanations.

```text
Financial Records
       │
       ▼
Deterministic Rules
       │
       ▼
Exception Detected
       │
       ▼
AI Explanation
       │
       ├── Why did this happen?
       ├── What caused the discrepancy?
       └── What action should be considered?
```

The reconciliation engine remains responsible for the actual matching and classification logic.

The AI layer is used to make detected exceptions easier for finance and operations teams to understand.

---

## Technology Stack

### Backend

* Node.js
* Express.js
* MySQL
* mysql2

### Frontend

* HTML5
* CSS3
* Vanilla JavaScript

### Data Processing

* CSV parsing
* String similarity matching
* Deterministic reconciliation rules
* Transaction validation

### Testing

* Node.js Test Runner
* Unit Tests
* API Integration Tests
* Validation Tests
* Exception Classification Tests

### DevOps

* GitHub Actions
* CI
* k6 Load Testing

---

## REST API

| Method | Endpoint                              | Description                    |
| ------ | ------------------------------------- | ------------------------------ |
| `GET`  | `/api/health`                         | API and database health        |
| `GET`  | `/api/reconciliation/summary`         | Reconciliation metrics         |
| `GET`  | `/api/reconciliation/orders`          | Orders and reconciliation data |
| `GET`  | `/api/reconciliation/exceptions`      | Exception records              |
| `GET`  | `/api/reconciliation/orders/:orderId` | Order reconciliation details   |

---

## Performance Testing

ReconAI was load tested using **k6** against the REST API.

### Results

| Metric                |        Result |
| --------------------- | ------------: |
| Maximum Virtual Users |            50 |
| Test Duration         |    60 seconds |
| Total HTTP Requests   |         5,464 |
| Throughput            |   89.91 req/s |
| Average Latency       |       7.29 ms |
| p95 Latency           |      24.37 ms |
| Error Rate            |            0% |
| Checks Passed         | 5,464 / 5,464 |

All configured performance thresholds passed successfully.

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

The test suite covers:

```text
Reconciliation Logic
        │
        ├── Matching
        ├── Amount Validation
        ├── Fee Adjustment
        ├── Exception Classification
        │
        ▼
REST API
        │
        ├── Health
        ├── Summary
        ├── Orders
        ├── Exceptions
        └── Order Details
        │
        ▼
Validation & Error Handling
```

---

## Project Structure

```text
ReconAI/
│
├── backend/
│   ├── routes/
│   ├── services/
│   ├── controllers/
│   └── ...
│
├── frontend/
│   ├── index.html
│   ├── css/
│   └── js/
│
├── data/
│   ├── orders/
│   ├── settlements/
│   └── bank/
│
├── tests/
│
├── docs/
│   └── images/
│       ├── reconai-hero.png
│       ├── reconai-architecture-3d.png
│       ├── reconai-dashboard.png
│       └── reconai-reconciliation-flow.png
│
├── .github/
│   └── workflows/
│
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

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Create `.env` using `.env.example`.

Configure the required database and API credentials.

> Never commit `.env` or secret credentials.

### 4. Start the Backend

```bash
npm start
```

API:

```text
http://localhost:3000
```

### 5. Start the Frontend

```bash
npx serve frontend -l 5500
```

Open the local URL displayed by the command.

---

## Engineering Highlights

ReconAI demonstrates practical software engineering across the complete application lifecycle:

```text
                    ReconAI
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
   Backend/API      Database       Frontend
        │              │              │
        └──────────────┼──────────────┘
                       │
                       ▼
                 Reconciliation
                       │
                       ▼
                   AI Layer
                       │
                       ▼
                 Testing + CI
                       │
                       ▼
                Load Testing
```

### Engineering Practices

* RESTful API design
* Layered backend architecture
* Relational database integration
* Input validation
* Error handling
* Deterministic matching algorithms
* Fuzzy matching
* Financial reconciliation logic
* Automated testing
* API integration testing
* Environment-based configuration
* Continuous integration
* Performance testing
* Finance-focused operational workflows

---

## Project Vision

ReconAI is built around a simple idea:

> **Turn fragmented payment records into reliable financial intelligence.**

Instead of manually comparing transactions across multiple systems, ReconAI provides a centralized reconciliation workflow for identifying, investigating, and explaining payment discrepancies.

---

## License

This project is licensed under the ISC License.
