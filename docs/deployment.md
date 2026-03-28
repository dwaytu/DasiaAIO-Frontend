---
layout: default
title: Deployment
permalink: /deployment/
---

# Deployment Guide

## Railway Deployment (Recommended)

### Step 1: Push to GitHub
```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

### Step 2: Create Railway Project
1. Go to [railway.app](https://railway.app)
2. Create new project
3. Connect GitHub repository

### Step 3: Configure Services

**PostgreSQL**
- Add Database → PostgreSQL
- Use generated `DATABASE_URL`

**Backend**
- Add Service → GitHub repo
- Root Directory: `DasiaAIO-Backend`
- Set environment variables:
  - `SERVER_HOST=0.0.0.0`
  - `SERVER_PORT=$PORT`
  - `ADMIN_CODE=122601`

**Frontend**
- Add Service → GitHub repo
- Root Directory: `DasiaAIO-Frontend`
- Build: `npm install && npm run build:web`
- Start: `npx serve -s app-dist -l $PORT`
- Environment: `VITE_API_BASE_URL=https://your-backend-url`

### Step 4: Deploy
- Railway auto-deploys on GitHub push
- Monitor in Deployments tab

---

## Platform Release Builds

From repository root:

```bash
npm run release:web
npm run release:desktop
npm run release:android
```

Desktop and Android wrappers are located in `apps/`:

- `apps/desktop-tauri`
- `apps/android-capacitor`

---

## Local Docker Deployment (Backend + Frontend)

### Build Docker Images
```bash
# Frontend
cd DasiaAIO-Frontend
docker build -t dasiaaio-frontend-local .
docker run -p 5173:3000 dasiaaio-frontend-local

# Backend
cd ../DasiaAIO-Backend
docker compose up -d --build
```

---

## Environment Variables

### Frontend
```env
VITE_API_BASE_URL=https://api.your-domain.example
VITE_APP_VERSION=1.0.0
VITE_LATEST_RELEASE_API_URL=https://api.github.com/repos/Cloudyrowdyyy/Capstone-Main/releases/latest
VITE_RELEASE_DOWNLOAD_URL=https://github.com/Cloudyrowdyyy/Capstone-Main/releases/latest
```

### Backend
```env
SERVER_HOST=0.0.0.0
SERVER_PORT=5000
DATABASE_URL=postgresql://user:pass@host:5432/db
APP_ENV=production
JWT_SECRET=<strong-random-secret-32-plus-chars>
ADMIN_CODE=<non-default-admin-code>
CORS_ORIGINS=https://your-frontend.example,capacitor://localhost,tauri://localhost,https://localhost,http://localhost
REQUEST_TIMEOUT_SECS=30
AUTH_RATE_LIMIT_MAX=10
AUTH_RATE_LIMIT_WINDOW_SECS=60
API_RATE_LIMIT_MAX=240
API_RATE_LIMIT_WINDOW_SECS=60
EXPENSIVE_RATE_LIMIT_MAX=30
EXPENSIVE_RATE_LIMIT_WINDOW_SECS=60
APP_VERSION=v1.0.0
APP_CHANGELOG=Release notes for this production version.
WEB_DOWNLOAD_URL=https://github.com/Cloudyrowdyyy/Capstone-Main/releases/latest
DESKTOP_DOWNLOAD_URL=https://github.com/Cloudyrowdyyy/Capstone-Main/releases/latest
MOBILE_DOWNLOAD_URL=https://github.com/Cloudyrowdyyy/Capstone-Main/releases/latest
```

### Staging Example

Use staging URLs and separate secrets from production:

```env
# Frontend (.env.staging)
VITE_API_BASE_URL=https://staging-api.your-domain.example
VITE_APP_VERSION=1.0.0-rc.1

# Backend (staging)
APP_ENV=staging
JWT_SECRET=<staging-secret>
ADMIN_CODE=<staging-admin-code>
CORS_ORIGINS=https://staging.your-domain.example,http://localhost:5173
APP_VERSION=v1.0.0-rc.1
```

### Production Safety Notes

- `APP_ENV=production` enforces backend startup guards for `JWT_SECRET`, non-default `ADMIN_CODE`, and explicit CORS configuration.
- Frontend release scripts validate production environment quality before packaging (`npm run release:web`, `release:desktop`, `release:android`).
- Keep frontend `VITE_APP_VERSION` and backend `APP_VERSION` synchronized with your release tag.
- Validate legal consent endpoints after deployment:
  - `GET /api/legal/consent/status`
  - `POST /api/legal/consent`

---

## GitHub Pages Documentation Update

The docs site at `https://cloudyrowdyyy.github.io/Capstone-Main` is generated from `DasiaAIO-Frontend/docs`.

To publish docs updates:

1. Edit files in `DasiaAIO-Frontend/docs`
2. Commit and push to `main`
3. Wait for GitHub Pages build to complete

---

## Troubleshooting

### Build Timeout
- Rust compilation can take 5-10 minutes
- First build is slower; subsequent builds faster

### Frontend can't reach backend
- Check `VITE_API_BASE_URL` matches backend URL
- Verify backend is healthy

### Database connection fails
- Ensure `DATABASE_URL` is set correctly
- Verify PostgreSQL service is healthy

---

[← Back to Home]({{ '/' | relative_url }})
