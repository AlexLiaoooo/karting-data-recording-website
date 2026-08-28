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
- Runs can be named from the run heading, edited in place, and the name follows the run through the session list, the comparison pickers and saved setup templates.
- Create a blank Run, duplicate the previous Run, or copy any historical Run's tyre and setup values.
- Compare every recorded performance, tyre, setup and feedback field, with differences highlighted.
- Automatic IndexedDB saving without an account. Pending writes are flushed when the app is backgrounded, so an edit made just before the phone is pocketed is not lost to a debounce timer that never fires.
- Versioned JSON backup/restore with confirmation, and an Excel-ready CSV export containing three tables: Events/Sessions/Runs, Track reference markers, and Session track observations.
- Reusable chassis setup templates.
- Explicit confirmation for cascading Event, Session and Run deletion.
- Editable Event and Session details.
- One-tap ambient temperature lookup using the device location and Open-Meteo, with manual entry retained as a fallback.
- Light and dark display modes with system-theme detection and a locally remembered manual toggle. The built-in maps carry no theme of their own, so they follow the toggle rather than the device setting.
- English and Simplified Chinese, switched from a button in every top bar and remembered in the browser. Dates follow the chosen language. Record values stay in English so data does not change with the interface.
- Integrated Track Map Notebook with reusable Tracks and Layouts, uploaded map images, pinch/ctrl-scroll zoom and pan, permanent In/Mid/Out/Brake/Gas/Others marker notes, general notes per Layout, and Session-specific observations.
- Numbered corner labels on every built-in circuit map, in lap order. A marker can be placed on a corner by name instead of aiming at the map, and can still be tapped anywhere for anything between corners.
- A marker placed on a corner stores the corner rather than a copy of its label, so renumbering a circuit renames every marker on it. A name typed by hand takes precedence and is never overwritten.
- Optional saved Track Layout selection on each Event and direct Track notes access from its Sessions.
- Full JSON backup/restore includes Track Maps, markers, Session observations and embedded map images.
- Built-in circuits added from a picker in the Track Library: PF International, Whilton Mill International and Kart Silverstone Grand Prix. Each map is a generated schematic based on OpenStreetMap raceway geometry with ODbL attribution in the UI. The start/finish line and the direction arrow are each drawn only where that detail is actually known: Kart Silverstone's lap is a reconstruction with an owner-supplied anti-clockwise direction and no start line recorded anywhere, so it shows the direction, omits the start, and says so in the track note.
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
- **Built-in maps** (`lib/track-map/built-in-maps.test.ts`) — corrected artwork replaces the
  copy already stored on a device, a map the user uploaded is never overwritten, marker
  positions survive the swap, and the asset size is read from the file's own viewBox. Also that
  every circuit in the registry is uniquely keyed, numbers its corners consecutively in lap
  order, keeps them inside the map and apart from each other, and points at a map file that
  exists and credits OpenStreetMap.
- **Markers and corners** (`lib/track-map/marker-corners.test.ts`) — a marker on a corner is
  named from the current corner list rather than from stored text, so it follows a renumbered
  circuit; a name typed by hand wins; and records written before corner numbers existed are
  matched back to their corner by position, never by the label, which after a renumber names a
  corner the marker is no longer on.
- **Counted nouns** (`lib/format.test.ts`) — "1 layout" rather than "1 layouts", including zero,
  multi-word nouns and nouns that do not simply take an s.
- **Translations** (`lib/i18n.test.ts`) — reads the components and asserts that every string
  passed to `t()` has a Chinese translation, that placeholders survive translation, and that
  values written into records (`Full Layout`, `PF International`) are never translated.

Image bytes are asserted through the backup path rather than the IndexedDB path: the
`fake-indexeddb` test double cannot round-trip a Blob, so blob persistence in the database
itself has to be checked in a real browser.

## Data ownership

Records are stored in IndexedDB in the current browser. There is no account or cloud synchronization in the first version. Export a JSON backup regularly, because clearing site data or losing the device/browser can remove the only copy.

## Deployment

The project is configured as a static Next.js export. The production build also generates a versioned service worker that precaches the exported application files. Connect the GitHub repository to Vercel and use the default Next.js build settings.
