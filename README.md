\# ReconAI



\## Intelligent Payment Reconciliation Platform



ReconAI is a full-stack payment reconciliation system that matches orders against payment settlements and bank transactions, identifies reconciliation exceptions, generates explanations and suggested actions, stores an audit trail, and exposes the results through a REST API and web dashboard.



\---



\## Features



\- Multi-source reconciliation between orders, settlements and bank statements

\- Exact reference matching

\- Fee-adjusted bank verification

\- Fuzzy reference matching

\- Amount mismatch detection

\- Missing settlement detection

\- Missing bank credit detection

\- Duplicate settlement detection

\- Delayed settlement handling

\- Rounding tolerance handling

\- Deterministic exception explanations

\- Suggested remediation actions

\- MySQL reconciliation audit trail

\- REST API

\- Interactive reconciliation dashboard

\- Search and category filtering

\- Priority and amount-based sorting

\- Pagination

\- Order-level reconciliation details

\- CSV export of filtered exceptions

\- Synthetic dataset generator

\- Automated matcher evaluation



\---



\## Architecture



```text

&#x20;                   ┌─────────────────────┐

&#x20;                   │     Orders CSV      │

&#x20;                   └──────────┬──────────┘

&#x20;                              │

&#x20;                   ┌──────────▼──────────┐

&#x20;                   │   Data Importer     │

&#x20;                   └──────────┬──────────┘

&#x20;                              │

&#x20;       ┌──────────────────────┼──────────────────────┐

&#x20;       │                      │                      │

&#x20;       ▼                      ▼                      ▼

&#x20;  Orders Table         Settlements Table      Bank Statement

&#x20;       │                      │                      │

&#x20;       └──────────────────────┼──────────────────────┘

&#x20;                              │

&#x20;                   ┌──────────▼──────────┐

&#x20;                   │ Reconciliation      │

&#x20;                   │ Engine              │

&#x20;                   └──────────┬──────────┘

&#x20;                              │

&#x20;                   ┌──────────▼──────────┐

&#x20;                   │ Exception           │

&#x20;                   │ Classification      │

&#x20;                   └──────────┬──────────┘

&#x20;                              │

&#x20;                   ┌──────────▼──────────┐

&#x20;                   │ Local Explanation   │

&#x20;                   │ Engine              │

&#x20;                   └──────────┬──────────┘

&#x20;                              │

&#x20;             ┌────────────────┴────────────────┐

&#x20;             │                                 │

&#x20;             ▼                                 ▼

&#x20;    reconciliation\_log                 REST API

&#x20;                                               │

&#x20;                                               ▼

&#x20;                                     Web Dashboard

