# Quantum Horizon — web

The frontend of [Quantum Horizon](https://quantum-horizon-web.vercel.app), a blink comparator for NASA's SPHEREx built
for NASA Space Apps 2026. Pick a star by name, by coordinates or on the sky map; it plays every SPHEREx exposure of that
spot in time order and shows what moved, with an uncertainty and a confidence label on every number.

| | |
|---|---|
| **Live** | <https://quantum-horizon-web.vercel.app> |
| **Project, docs and history** | [KhamessiTaha/quantum-horizon](https://github.com/KhamessiTaha/quantum-horizon) |
| **API** | [KhamessiTaha/quantum-horizon-api](https://github.com/KhamessiTaha/quantum-horizon-api) · live at <https://quantum-horizon-api.vercel.app/api/health> |

This repository is the frontend of the main project, kept with its history so Vercel can build it from a root folder.
Make changes in the main repository and merge them across.

## Run locally

Node 20 or newer:

```
npm install
npm run dev
```

Then open <http://localhost:5173>. In development it talks to an API at `http://localhost:8000` (run the backend from
the main repository); set `VITE_API_BASE` to use another, for example the live one. A production build uses the
deployed API unless `VITE_API_BASE` says otherwise.

```
npm run build
npm run lint
```

## What is in it

React, TypeScript and Vite, with CSS modules and no UI framework.

- `src/pages/Landing.tsx` — the hero with real SPHEREx frames, the five challenge targets, and the sky map.
- `src/pages/Viewer.tsx` — the tool: blink and difference player, detectors D1–D6, field of view, passes, and the
  measurements, with the sky map, spectrum, brightness and mover search as tabs.
- `src/pages/Methods.tsx` — how every number is measured and where it stops.
- `src/components/SkyMap.tsx` — Aladin Lite on WISE, 2MASS and DSS2 imagery from IRSA, SIMBAD names on top; click
  anywhere, or on a name, to blink it.
- `src/components/SearchBox.tsx` — names, decimal or sexagesimal coordinates, and suggestions as you type.
- `src/lib/viewState.ts` — every setting lives in the URL, so any view can be shared or embedded (`&embed=1`).
- `src/lib/api.ts` — the API client.

The look: dark ground `#0a0c0f`, IBM Plex Sans and Mono, cyan for measured values, amber for catalog predictions.
Tokens are in `src/index.css`.

## Deploying

Import this repository into Vercel. `vercel.json` sets the build and the single-page rewrite; no environment variable
is needed for the live API. The API must list this site in its `QH_ALLOWED_ORIGINS`.

## Data and credits

SPHEREx images: NASA/JPL-Caltech/IPAC, via the NASA/IPAC Infrared Science Archive and the SPHEREx mirror on AWS Open
Data. Positions and proper motions: SIMBAD (CDS) and Gaia DR3 (ESA). Sky imagery: WISE, 2MASS and DSS2 via IRSA, shown
with Aladin Lite (CDS).
