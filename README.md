# SENTINEL Security Operations Management System

> **Comprehensive Asset Management & Operations Platform**

A modern, full-stack web application for managing assets, inventory, and operations. Built with React, TypeScript, Rust, and PostgreSQL.

---

## 📖 Documentation

**👉 [View Full Documentation & Setup Guide](https://cloudyrowdyyy.github.io/capstone-1.0)**

All information about installation, features, API endpoints, and deployment can be found on the documentation site.

---

## 🎯 Quick Links

- **Live Application:** https://dasiaaio.up.railway.app
- **Documentation:** https://cloudyrowdyyy.github.io/capstone-1.0
- **GitHub Repository:** https://github.com/Cloudyrowdyyy/capstone-1.0

---

## 📦 Tech Stack

- **Frontend:** React 18 + TypeScript + Vite
- **Backend:** Rust + Axum
- **Database:** PostgreSQL
- **Deployment:** Docker + Railway

---

## Quality and Performance Updates

Recent updates focused on performance, validation, and reliability:

- Refactored `src/components/CalendarDashboard.tsx` to reduce repeated filtering and counting work by using memoized indexed event data.
- Added safer event normalization to skip invalid records instead of crashing UI rendering.
- Added partial-source failure handling so the calendar can still render if one API source fails.
- Improved API utility error handling in `src/utils/api.ts`:
	- non-JSON response fallback parsing,
	- request timeout support (`fetchJsonOrThrow(..., timeoutMs)`),
	- consistent user-facing error behavior.
- Added unit tests for API utility behavior in `src/__tests__/api.test.ts`.

---

## Verification Commands

Run from `DasiaAIO-Frontend/`:

```bash
npm test -- --runInBand
npm run build
```

## Cross-Platform Builds

SENTINEL now ships from one frontend source to web, Android, and desktop wrappers.

- Build web bundle:
	- `npm run build:web`
- Build Android web assets and sync to Capacitor project:
	- `npm run build:android`
- Build desktop web assets and package with Tauri:
	- `npm run build:desktop`

Platform wrappers are located at:

- `../apps/android-capacitor`
- `../apps/desktop-tauri`

Environment files are mode-specific:

- `.env.web`
- `.env.mobile`
- `.env.desktop`

Important Android note: update `.env.mobile` to use your machine LAN IP (not localhost), for example:

- `VITE_API_BASE_URL=http://192.168.1.25:5000`

Expected outcome:

- Jest test suite passes.
- Vite production build succeeds.

---

**Complete documentation is available at:** [`https://cloudyrowdyyy.github.io/capstone-1.0`](https://cloudyrowdyyy.github.io/capstone-1.0)

The documentation site includes:
- **Installation & Setup** - Step-by-step installation guide
- **API Reference** - Complete API documentation
- **Deployment Guide** - Railway & local deployment instructions
- **Features Overview** - Core modules and capabilities

- **Comprehensive Docs:** https://cloudyrowdyyy.github.io/capstone-1.0

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## 📄 License

This project is proprietary software. Unauthorized copying prohibited.

---

## 👥 Team

- **Frontend**: React/TypeScript development
- **Backend**: Rust/Axum API server
- **Database**: PostgreSQL management

---

## 📞 Support

For issues or questions:
1. Check https://cloudyrowdyyy.github.io/capstone-1.0
2. Review error logs in Railway dashboard
3. Check browser developer console (F12)

---

## 🔗 Live Demo

**Production**: [https://dasiaaio.up.railway.app](https://dasiaaio.up.railway.app)

---

**Last Updated**: February 17, 2026  
**Status**: ✅ Active & Maintained
