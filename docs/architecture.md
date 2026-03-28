---
layout: default
title: Architecture
permalink: /architecture/
---

# System Architecture

## High-Level Topology

```text
Web / Desktop / Android Clients
            |
            v
   React + TypeScript + Vite UI
            |
            v
      Rust + Axum API Layer
            |
            v
        PostgreSQL Storage
```

## Client Runtime Layer

- Web runtime for browser operations
- Tauri desktop runtime for command-center deployment
- Capacitor Android runtime for field use

All clients share one frontend codebase and use a single backend API contract.

## Backend Service Layer

Core backend areas:

- Auth and account lifecycle handlers
- Role authorization and legal-consent enforcement middleware
- Domain handlers (users, shifts, incidents, tracking, assets, analytics)
- Deterministic AI service modules for decision support

## Data Layer

PostgreSQL stores:

- Identity and approval records
- Session and token-lifecycle tables
- Attendance, scheduling, and replacement workflows
- Firearm, permit, maintenance, and vehicle operations
- Incident, support, tracking, and audit records

## Request Lifecycle

1. Client sends authenticated API request.
2. Middleware applies CORS, timeout, and rate-limit checks.
3. Auth middleware validates token and role.
4. Legal-consent middleware blocks protected access until consent is accepted.
5. Handler executes business logic and persistence operations.
6. Structured response is returned to the client.

## Real-Time and Resilience

- Tracking supports WebSocket snapshot streaming.
- Polling fallback preserves continuity during socket disruption.
- Health endpoints provide operational status (`/api/health`, `/api/health/system`).

## Release and Update Flow

- Backend exposes release metadata (`/api/system/version`).
- Frontend checks backend metadata and prompts per runtime.
- Web, desktop, and mobile channels are routed to release-specific downloads.

---

[← Back to Home]({{ '/' | relative_url }})
