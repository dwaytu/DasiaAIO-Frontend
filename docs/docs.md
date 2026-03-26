---
layout: default
title: Documentation
permalink: /docs/
---

# Documentation

## Architecture Overview

```
Frontend (React + Vite)          Backend (Rust + Axum)         Database (PostgreSQL)
├── Web UI                        ├── API routes                 ├── Users and roles
├── Shared platform build         ├── AuthZ + audit middleware   ├── Firearms and permits
├── Desktop/mobile wrappers       ├── Analytics + AI handlers    ├── Tracking and incidents
└── Real-time map modules         └── Websocket tracking         └── Vehicles and trips
```

---

## User Roles

| Role | Permissions |
|------|------------|
| **Superadmin** | Full platform administration and elevated management actions |
| **Admin** | Operations, inventory, permits, schedules, analytics |
| **Supervisor** | Shift supervision, attendance, replacements, reporting |
| **Guard** | Assigned operations, check-in/out, self-service requests |

---

## Core Modules

### Firearm Inventory Management
Track and manage firearm assets with status, maintenance, and allocation context.

### Firearm Allocation System
Issue and return workflows with active and overdue allocation visibility.

### Maintenance Tracking
Schedule and complete maintenance for firearms and armored vehicles.

### Guard Permitting
Manage permit lifecycle including expiring and auto-expire workflows.

### Trip and Vehicle Operations
Armored car assignment, driver management, trip lifecycle, and maintenance tracking.

### Incidents and Notifications
Incident creation/status workflows and user notification delivery.

### Performance Analytics
Analytics, trend views, predictive alerts, and AI-assisted incident intelligence.

### Real-Time Tracking
Live operational map, client site management, and websocket-based tracking feeds.

---

## Platform Packaging

SENTINEL uses one frontend source with platform wrappers:

- Web app deployment
- Desktop wrapper via Tauri (`apps/desktop-tauri`)
- Android wrapper via Capacitor (`apps/android-capacitor`)

---

## Troubleshooting

### Backend won't start
1. Ensure PostgreSQL is running
2. Check `DATABASE_URL` environment variable
3. Verify database exists

### Frontend can't reach backend
1. Check `VITE_API_BASE_URL` in mode file
2. Verify backend is running on port 5000
3. Check browser console for CORS or auth errors

### Android app cannot connect to local backend
1. Use LAN IP in `.env.mobile`
2. Ensure phone and backend host are on the same network
3. Confirm backend allows configured CORS origin

---

[← Back to Home]({{ '/' | relative_url }})
