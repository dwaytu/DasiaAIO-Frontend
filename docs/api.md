---
layout: default
title: API Reference
permalink: /api/
---

# API Reference

Base URL (local): `http://localhost:5000/api`

Most routes require a valid access token and are guarded by role-based middleware.

---

## Authentication Endpoints

### Register
```http
POST /api/register
Content-Type: application/json

{
  "email": "user@gmail.com",
  "password": "password123",
  "username": "guard_001",
  "full_name": "Full Name",
  "phone_number": "+63-555-123-4567",
  "role": "guard",
  "licenseIssuedDate": "2026-01-01",
  "licenseExpiryDate": "2027-01-01"
}
```

Notes:

- Public registration is intended for guard onboarding.
- Approval is required before account activation.

### Login
```http
POST /api/login
Content-Type: application/json

{
  "email": "user@gmail.com",
  "password": "password123"
}
```

### Verify Email
```http
POST /api/verify
Content-Type: application/json

{
  "email": "user@gmail.com",
  "code": "123456"
}
```

Additional auth routes:

- `POST /api/resend-code`
- `POST /api/forgot-password`
- `POST /api/verify-reset-code`
- `POST /api/reset-password`
- `POST /api/refresh`
- `POST /api/logout`

Equivalent `/api/auth/*` aliases are also supported.

---

## User Management

### Get All Users
```http
GET /api/users
```

### Approval Workflow

- `GET /api/users/pending-approvals`
- `PUT /api/users/:id/approval`

### User CRUD

- `GET /api/user/:id`
- `PUT /api/user/:id`
- `DELETE /api/user/:id`
- `GET /api/users/:id` (alias)

---

## Firearm Management

### Get All Firearms
```http
GET /api/firearms
```

### Add Firearm
```http
POST /api/firearms
Content-Type: application/json

{
  "serial_number": "SN123456",
  "model": "Glock 19",
  "type": "Pistol",
  "status": "available"
}
```

### Allocation and Maintenance

- `POST /api/firearm-allocation/issue`
- `POST /api/firearm-allocation/return`
- `GET /api/firearm-allocations/active`
- `GET /api/firearm-allocations/overdue`
- `POST /api/firearm-maintenance/schedule`
- `GET /api/firearm-maintenance/pending`

### Permits and Training

- `GET /api/guard-firearm-permits`
- `GET /api/guard-firearm-permits/expiring`
- `POST /api/training-records`
- `GET /api/training-records/expiring`

---

## Operations, Tracking, and AI

### Core Operations

- `GET /api/analytics`
- `GET /api/alerts/predictive`
- `POST /api/incidents`
- `GET /api/incidents/active`
- `GET /api/tracking/map-data`
- `GET /api/tracking/ws` (websocket)

### AI Endpoints

- `GET /api/ai/guard-absence-risk`
- `GET /api/ai/replacement-suggestions`
- `GET /api/ai/vehicle-maintenance-risk`
- `POST /api/ai/classify-incident`
- `POST /api/ai/summarize-incident`

### Vehicle and Trip Management

- `GET /api/armored-cars`
- `POST /api/car-allocation/issue`
- `POST /api/car-allocation/return`
- `POST /api/trips`
- `GET /api/trip-management/active`

---

## Health Check
```http
GET /api/health
```

System health:

- `GET /api/health/system`

---

## RBAC Notes

Core hierarchy:

- `superadmin > admin > supervisor > guard`

Authorization is enforced per route using backend middleware.

---

[← Back to Home]({{ '/' | relative_url }})
