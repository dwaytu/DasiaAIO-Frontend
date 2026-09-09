# SENTINEL Frontend

Frontend application for SENTINEL, the DSIA security operations platform.

## Overview

This repository contains the shared client used by:

- Web runtime
- Desktop runtime (Tauri wrapper)
- Android runtime (Capacitor wrapper)

The frontend implements role-governed command and field workflows for guards, supervisors, admins, and superadmins.

## Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Jest + Testing Library
- Playwright
- Leaflet / React-Leaflet

## Prerequisites

- Node.js 20+
- npm 10+

## Setup

```bash
npm install
```

## Environment

Primary runtime variable:

```env
VITE_API_BASE_URL=https://your-backend-domain
```

Release/version variable:

```env
VITE_APP_VERSION=v1.0.0
```

Mode files supported:

- `.env.development`
- `.env.production`
- optional mode-specific files (`.env.web`, `.env.mobile`, `.env.desktop`)

## Development

```bash
npm run dev
```

## Quality Gates

Unit/integration tests:

```bash
npm test -- --runInBand
```

E2E tests:

```bash
npm run test:e2e
```

Production build:

```bash
npm run build
```

## Platform Build Commands

Web build:

```bash
npm run build:web
```

Desktop build (web bundle + Tauri wrapper build trigger):

```bash
npm run build:desktop
```

Android build (web bundle + Capacitor sync trigger):

```bash
npm run build:android
```

## Release Commands

```bash
npm run release:web
npm run release:desktop
npm run release:android
npm run release:android:bundle
npm run release:all
```

Release scripts validate production-critical settings and fail fast when configuration is unsafe.

## Repository Links

- Root governance/release repo: https://github.com/dwaytu/Capstone-Main
- Backend service repo: https://github.com/dwaytu/DasiaAIO-Backend
- Project docs: https://dwaytu.github.io/Capstone-Main/

## Notes

### Browser Regression Tests

`npm run test:e2e` runs UI regressions plus a live login/logout smoke test.
Start the local backend and use a provisioned test guard account, setting
`E2E_USERNAME` and `E2E_PASSWORD` in the shell before running the suite.
The aliases `AUDIT_GUARD_IDENTIFIER` and `AUDIT_GUARD_PASSWORD` are also accepted.
Do not use production credentials or commit credentials to test files.
The remaining browser specs mock their API responses and can run without a
backend using `npx playwright test guard-dashboard inbox operational-requests`.

- This codebase follows SOC-style command-center UI conventions defined in root governance docs.
- `VITE_API_BASE_URL` is the authoritative backend origin for all protected API calls.
