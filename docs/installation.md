---
layout: default
title: Installation & Setup
permalink: /installation/
---

# Installation & Setup

## Prerequisites

- Node.js 20+
- Rust 1.70+
- PostgreSQL 12+
- Git

---

## Quick Start

### 1. Clone Repository
```bash
git clone https://github.com/Cloudyrowdyyy/capstone-1.0.git
cd capstone-1.0
```

### 2. Install Dependencies
```bash
npm install
npm install --prefix DasiaAIO-Frontend
```

### 3. Configure and Run Backend
```bash
cd DasiaAIO-Backend
cp .env.example .env
cargo run
```

Backend default URL: `http://localhost:5000`

### 4. Database Setup
```bash
psql -U postgres -c "CREATE DATABASE guard_firearm_system;"
```

### 5. Run Frontend
```bash
npm run dev --prefix DasiaAIO-Frontend
```

Frontend default URL: `http://localhost:5173`

---

## Environment Configuration

Create frontend mode files in `DasiaAIO-Frontend/` as needed:

```env
# .env.web
VITE_API_BASE_URL=http://localhost:5000
```

```env
# .env.mobile (use LAN IP when testing on phone)
VITE_API_BASE_URL=http://192.168.1.25:5000
```

```env
# .env.desktop
VITE_API_BASE_URL=http://localhost:5000
```

Create backend `.env` in `DasiaAIO-Backend/`:

```env
SERVER_HOST=0.0.0.0
SERVER_PORT=5000
DATABASE_URL=postgresql://postgres:password@localhost:5432/guard_firearm_system
ADMIN_CODE=122601
```

---

## Platform Build Commands

Run from repository root:

```bash
npm run build:web
npm run build:desktop
npm run build:android
```

---

## Troubleshooting

### "Port already in use"
```powershell
Get-NetTCPConnection -LocalPort 5173 -State Listen | Select-Object -First 1 -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }
Get-NetTCPConnection -LocalPort 5000 -State Listen | Select-Object -First 1 -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }
```

### "Database connection failed"
```bash
psql postgresql://postgres:password@localhost/guard_firearm_system
```

### "Build fails"
```bash
npm install
npm install --prefix DasiaAIO-Frontend
```

---

[← Back to Home]({{ '/' | relative_url }})
