# ReconAI

## Intelligent Payment Reconciliation Platform

ReconAI is a full-stack payment reconciliation platform that matches orders against payment settlements and bank transactions, identifies reconciliation exceptions, generates AI-powered explanations and suggested actions, stores reconciliation results, and exposes them through a REST API and interactive web dashboard.

---

## Overview

Payment reconciliation requires comparing financial records from multiple sources and identifying cases where references, amounts, settlements, or bank entries do not align.

ReconAI automates this process using deterministic reconciliation rules, tolerance-based amount checks, reference normalization, fuzzy matching, exception classification, and AI-generated explanations.

The platform is designed around a practical finance operations workflow:

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