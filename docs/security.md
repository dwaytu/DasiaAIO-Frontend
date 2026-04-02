---
layout: default
title: Security
permalink: /security/
---

# Security and Compliance Profile

## Authentication and Session Security

- JWT access and refresh tokens
- Refresh-session persistence with revocation and rotation controls
- Guard account approval gating before operational access
- Session invalidation on logout flows

## Legal Consent Enforcement

- First-use legal confirmation is required before protected workflows.
- Consent state is persisted server-side with timestamp and version.
- Consent record includes requester IP and user-agent trace.
- Protected route middleware rejects access when legal consent is missing.

## Authorization and Access Control

- Route-level role authorization middleware
- Hierarchical permissions (`superadmin > admin > supervisor > guard`)
- Guard ownership checks on self-scoped workflows

## API Protection Controls

- Multi-layer rate limiting (auth, API, expensive endpoints)
- Request timeout middleware for long-running request protection
- CORS allow-list controls with wrapper-origin coverage
- Standardized structured API error responses

## Security Response Headers

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- Content Security Policy (CSP)
- HSTS in production environment

## Governance and Auditability

- Centralized write-action audit logging
- Access and anomaly investigation endpoints
- Health and runtime telemetry endpoints for operational monitoring

## Deployment Security

- Environment validation for production release builds
- Non-root backend container runtime
- Lockfile-based deterministic backend image builds

## Legal Documents

- [Terms of Agreement](https://github.com/dwaytu/Capstone-Main/blob/main/TermsOfAgreement.md)
- [Privacy Policy](https://github.com/dwaytu/Capstone-Main/blob/main/PrivacyPolicy.md)
- [Acceptable Use Policy](https://github.com/dwaytu/Capstone-Main/blob/main/AcceptableUsePolicy.md)

---

[← Back to Home]({{ '/' | relative_url }})
