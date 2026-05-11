# County Line

County Line is a map-first web app for exploring U.S. geographies and public data across multiple administrative levels.

## What this project is
County Line is being built as a Progressive Web App (PWA) with a focus on:
- Nationwide map navigation (state, county, municipality/CDP).
- Federal and state district overlays.
- Public-data overlays (starting with Census and BLS).
- Fast, device-friendly experience on desktop, tablet, and mobile.

## Why this stack
- **Frontend:** Next.js (App Router + TypeScript) for modern React patterns and strong production ergonomics.
- **Mapping:** MapLibre GL JS for open-source vector-map rendering.
- **Cloud direction:** AWS-first architecture (to be implemented incrementally as features land).

## Current status
This repository now contains the initial app scaffold and a first interactive map shell.

## Roadmap (short)
1. Load and render U.S. boundary tiles.
2. Add layer toggles for congressional and state legislative districts.
3. Add first data overlays (BLS unemployment, Census population).
4. Add geography search and drill-down interactions.
5. Connect to cloud ingestion + API endpoints.

## Development
```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Scripts
- `npm run dev` – run local dev server.
- `npm run build` – production build.
- `npm run start` – run production server.
- `npm run lint` – run ESLint.

## Notes
- Map tiles/data endpoints are placeholders for now and will be wired in upcoming commits.
- Secrets and cloud configuration should be managed via environment variables.
