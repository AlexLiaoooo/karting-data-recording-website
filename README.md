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
- Versioned JSON backup/restore with confirmation, and an Excel-ready CSV export containing three tables: Events/Sessions/Runs, Track reference markers, and Session track observations.
- Reusable chassis setup templates.
- Explicit confirmation for cascading Event, Session and Run deletion.
- Editable Event and Session details.
- One-tap ambient temperature lookup using the device location and Open-Meteo, with manual entry retained as a fallback.
- Light and dark display modes with system-theme detection and a locally remembered manual toggle.
- Integrated Track Map Notebook with reusable Tracks and Layouts, uploaded map images, zoom/pan, permanent Corner/Braking/Turn-in/Apex/Exit notes, and Session-specific observations.
- Optional saved Track Layout selection on each Event and direct Track notes access from its Sessions.
- Full JSON backup/restore includes Track Maps, markers, Session observations and embedded map images.
- The PF International quick-start map is a generated schematic based on OpenStreetMap raceway geometry and includes ODbL attribution in the UI.
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
npm test
npm run build
```

`npm test` runs Vitest against the data layer — the parts where a silent bug costs recorded
data rather than looking wrong:

- **Backup round-trip** (`lib/track-map/backup.test.ts`) — events, tracks, layouts, markers
  and visits restore unchanged, map image bytes survive exactly, backups predating Track
  Maps still restore, and malformed files are rejected instead of partially applied.
- **CSV export** (`lib/csv.test.ts`) — the three tables, correct column counts, computed
  pressure/temperature gains, the UTF-8 BOM, and escaping of quotes, commas and line breaks
  in free-text notes.
- **Storage** (`lib/database.test.ts`) — the version 1 to 2 schema upgrade preserves existing
  records while adding the Track Map stores, deletions do not reappear on reload, and app
  data stays separate from Track Map data.
- **Built-in maps** (`lib/track-map/built-in-map.test.ts`) — corrected artwork replaces the
  copy already stored on a device, a map the user uploaded is never overwritten, marker
  positions survive the swap, and the asset size is read from the file's own viewBox.

Image bytes are asserted through the backup path rather than the IndexedDB path: the
`fake-indexeddb` test double cannot round-trip a Blob, so blob persistence in the database
itself has to be checked in a real browser.

## Data ownership

Records are stored in IndexedDB in the current browser. There is no account or cloud synchronization in the first version. Export a JSON backup regularly, because clearing site data or losing the device/browser can remove the only copy.

## Deployment

The project is configured as a static Next.js export. The production build also generates a versioned service worker that precaches the exported application files. Connect the GitHub repository to Vercel and use the default Next.js build settings.
