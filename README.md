# SENTINEL Frontend

React + TypeScript + Vite frontend for the SENTINEL security operations platform.

## Stack

- React 18
- TypeScript
- Vite
- Jest + Testing Library
- Tailwind CSS

## Install

```bash
npm install
```

## Local Development

```bash
npm run dev
```

## Test and Build

```bash
npm test -- --runInBand
npm run build
```

## Multi-Platform Build Targets

This frontend is the shared source for web, desktop, and Android packaging.

```bash
# Web production bundle
npm run build:web

# Android web bundle + Capacitor sync
npm run build:android

# Desktop web bundle + Tauri build
npm run build:desktop
```

Release scripts:

```bash
npm run release:web
npm run release:desktop
npm run release:android
npm run release:android:bundle
npm run release:all
```

Production release scripts now enforce environment validation and will fail fast if required values are missing or unsafe (for example localhost/private API URLs).

Required release env vars:

```env
VITE_API_BASE_URL=https://your-production-backend
VITE_APP_VERSION=v1.2.3
```

Wrapper project locations:

- `../apps/android-capacitor`
- `../apps/desktop-tauri`

## Environment Modes

Use mode-specific environment files:

- `.env.development`
- `.env.production`

Platform-specific files (`.env.web`, `.env.mobile`, `.env.desktop`) are also pinned to the same backend origin so web, desktop, and mobile builds remain aligned.

`VITE_API_BASE_URL` is the only API endpoint variable used by the client runtime.

## Key Links

- Production: https://dasiaaio.up.railway.app
- Documentation: https://cloudyrowdyyy.github.io/capstone-1.0
- Repository: https://github.com/Cloudyrowdyyy/capstone-1.0
