---
layout: default
title: Download
permalink: /download/
---

# Download SENTINEL

Use the channels below to access current platform builds.

## Web Runtime

- URL: [https://dasiaaio.up.railway.app](https://dasiaaio.up.railway.app)
- Recommended for: Command center browsers and administrative access.
- Update behavior: Backend-driven version checks prompt when a newer release is available.

## Desktop Runtime (Windows via Tauri)

- Release feed: [GitHub Releases](https://github.com/Cloudyrowdyyy/Capstone-Main/releases/latest)
- Recommended for: Command-center desktops that need a packaged runtime.
- Update behavior: In-app update detection with download-and-restart flow where supported.

## Mobile Runtime (Android via Capacitor)

- Release feed: [GitHub Releases](https://github.com/Cloudyrowdyyy/Capstone-Main/releases/latest)
- Recommended for: Field guard and supervisor operations.
- Update behavior: Runtime prompts user to install newer package builds.

## Version Metadata Source

All clients use backend release metadata from:

```http
GET /api/system/version
```

This keeps update behavior consistent across web, desktop, and mobile clients.

## Integrity and Rollout Notes

- Use production-tagged release artifacts only.
- Keep frontend `VITE_APP_VERSION` aligned with the release tag.
- Keep backend `APP_VERSION` aligned with published release metadata.
- Validate staging before production rollout.

## Related Guides

- [Installation](installation/)
- [Deployment](deployment/)
- [Security](security/)

---

[← Back to Home]({{ '/' | relative_url }})
