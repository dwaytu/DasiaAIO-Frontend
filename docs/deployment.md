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
VITE_API_BASE_URL=https://your-backend-url
```

### Backend
```env
SERVER_HOST=0.0.0.0
SERVER_PORT=5000
DATABASE_URL=postgresql://user:pass@host:5432/db
ADMIN_CODE=122601
```

---

## GitHub Pages Documentation Update

The docs site at `https://cloudyrowdyyy.github.io/capstone-1.0` is generated from `DasiaAIO-Frontend/docs`.

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
