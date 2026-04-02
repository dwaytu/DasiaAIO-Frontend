---
layout: default
---

# SENTINEL Security Operations Platform

SENTINEL is an enterprise security operations platform for personnel deployment, asset governance, mission workflows, incident response, and command-center analytics.

## Platform Overview

- Frontend: React + TypeScript + Vite
- Backend: Rust + Axum
- Database: PostgreSQL
- Web app: Railway-hosted deployment
- Desktop wrapper: Tauri
- Mobile wrapper: Capacitor (Android)

Live application: [https://dasiaaio.up.railway.app](https://dasiaaio.up.railway.app)

## Quick Navigation

- [Download Portal](download/) - Platform-specific release channels for web, desktop, and Android
- [Feature Catalog](features/) - Operational modules and role-focused capabilities
- [Security Profile](security/) - Runtime hardening, governance, and compliance controls
- [System Architecture](architecture/) - End-to-end architecture and request lifecycle
- [Installation](installation/) - Local setup and prerequisites
- [System Documentation](docs/) - Architecture, modules, and operational references
- [API Reference](api/) - Core routes, auth, and integration contracts
- [Deployment Guide](deployment/) - Staging and production release flow

## Legal and Compliance

- [Terms of Agreement](https://github.com/dwaytu/Capstone-Main/blob/main/TermsOfAgreement.md)
- [Privacy Policy](https://github.com/dwaytu/Capstone-Main/blob/main/PrivacyPolicy.md)
- [Acceptable Use Policy](https://github.com/dwaytu/Capstone-Main/blob/main/AcceptableUsePolicy.md)

## Current Release Highlights

- Backend-enforced legal consent state before protected workflows
- Consent record persistence with timestamp, version, requester IP, and user agent trace
- Rotating refresh-session model with revocation-aware token lifecycle
- Production middleware stack with strict CORS, rate limiting, timeout controls, and security headers
- Cross-platform update checks with runtime-aware download guidance

## Licensing

SENTINEL is proprietary software and is distributed under an All Rights Reserved license.

## Start Here

- [Installation](installation/)
- [Documentation](docs/)
- [API Reference](api/)
- [Deployment Guide](deployment/)

## What Is Current In This Release

- Shared frontend build for web, desktop, and Android wrappers
- Guard approval workflow for self-registration
- Expanded role-aware API authorization and audit logging
- AI-assisted analytics endpoints for risk and incident workflows
- Real-time operational map and tracking endpoints

## Repository

- GitHub: [https://github.com/dwaytu/Capstone-Main](https://github.com/dwaytu/Capstone-Main)
- Issues: [https://github.com/dwaytu/Capstone-Main/issues](https://github.com/dwaytu/Capstone-Main/issues)

Status: Active and maintained  
Last updated: March 28, 2026
