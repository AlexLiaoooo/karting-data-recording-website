# Kart Data

A mobile-first, local-first web application for recording competition karting tyre data, chassis setup, performance and driver feedback at the circuit.

**Live website:** [Open Kart Data](https://karting-data-recording-website.vercel.app)

## User guide

- [中文用户操作手册](USER_GUIDE.zh-CN.md)

## Current features

- Event → Session → Run record hierarchy.
- Cold/hot tyre pressure and temperature for all four corners.
- Kart-specific chassis setup fields.
- Performance and driver feedback recording.
- Create a blank Run, duplicate the previous Run, or copy any historical Run's tyre and setup values.
- Compare every recorded performance, tyre, setup and feedback field, with differences highlighted.
- Automatic IndexedDB saving without an account.
- Versioned JSON backup/restore with confirmation and a complete Excel-ready CSV export.
- Reusable chassis setup templates.
- Explicit confirmation for cascading Event, Session and Run deletion.
- Editable Event and Session details.
- One-tap ambient temperature lookup using the device location and Open-Meteo, with manual entry retained as a fallback.
- Light and dark display modes with system-theme detection and a locally remembered manual toggle.
- Integrated Track Map Notebook with reusable Tracks and Layouts, uploaded map images, zoom/pan, permanent Corner/Braking/Turn-in/Apex/Exit notes, and Session-specific observations.
- Optional saved Track Layout selection on each Event and direct Track notes access from its Sessions.
- Full JSON backup/restore includes Track Maps, markers, Session observations and embedded map images.
- Installable iPhone/PWA shell with Apple touch icons, in-app instructions and offline caching in production.
- Static production output suitable for Vercel.

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Verification

```bash
npm run lint
npm run build
```

## Data ownership

Records are stored in IndexedDB in the current browser. There is no account or cloud synchronization in the first version. Export a JSON backup regularly, because clearing site data or losing the device/browser can remove the only copy.

## Deployment

The project is configured as a static Next.js export. The production build also generates a versioned service worker that precaches the exported application files. Connect the GitHub repository to Vercel and use the default Next.js build settings.
