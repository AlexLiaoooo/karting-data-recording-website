# Karting Data Recording Website — Design Document

**Document status:** Implemented prototype v0.8
**Last updated:** 2026-08-15
**Deployment target:** Vercel
**Primary device:** Mobile phone  
**Initial storage model:** Local to the current browser/device, without user accounts

## 1. Purpose

Build a fast, trackside-first web application for recording competition karting data during practice and race events. The application should minimize the time and number of taps required to record tyre pressures, tyre temperatures, chassis setup, performance, and driver feedback.

The first version will be deliberately small and reliable. It will work without an account, preserve data on the current device, and remain usable when the internet connection at the circuit is poor or unavailable.

## 2. Product goals

- Open quickly on a phone and allow recording to begin immediately.
- Organize records using the hierarchy `Event → Session → Run`.
- Make it easy to add a new Run and reuse the previous Run's setup.
- Record tyre, chassis, performance, and subjective feedback data.
- Save edits automatically without requiring a manual Save button.
- Work offline after the application has been loaded or installed.
- Allow the user to export and restore their data without an account.
- Keep the source code portable and under the owner's control.
- Leave room for later cloud synchronization, team sharing, and analysis.
- Build reusable visual circuit knowledge with permanent map markers and Session-specific observations.

## 3. First-version non-goals

The initial release will not include:

- User registration or login.
- Automatic synchronization between devices.
- Shared team or mechanic access.
- Cloud database storage.
- Live timing integration.
- Automatic weather integration.
- AI-generated setup recommendations.
- Payment or subscription features.

These may be considered after the local-first workflow has been tested at real events.

## 4. Record hierarchy

The confirmed hierarchy is:

```text
Event
└── Session
    └── Run
```

Example:

```text
Event: Whilton Mill — 12 August 2026
├── Practice 1
│   ├── Run 1
│   ├── Run 2
│   └── Run 3
├── Qualifying
│   └── Run 1
└── Final
    └── Run 1
```

### Event

An Event represents a race meeting or testing/practice day at one circuit on one date or date range.

### Session

A Session represents an official or logical part of the Event, such as Practice 1, Practice 2, Qualifying, Heat 1, or Final.

### Run

A Run represents one outing on track within a Session. Setup changes and before/after tyre measurements are recorded at Run level.

## 5. Proposed first-version fields

The following fields are provisional defaults. They will be refined after the first real-world trial.

### 5.1 Event fields

- Event name.
- Circuit/track name.
- Start date.
- End date, when applicable.
- Event type: Practice, Test, Race, or Other.
- Weather summary.
- Ambient temperature in °C.
- Track temperature in °C.
- Track condition: Dry, Damp, Wet, or Mixed.
- Event-level notes.

### 5.2 Session fields

- Session name, for example Practice 1 or Heat 2.
- Session type: Practice, Qualifying, Heat, Pre-final, Final, or Other.
- Scheduled or actual start time.
- Session notes.

### 5.3 Run identification

- Automatically generated Run number.
- Start time or recorded time.
- Number of laps.
- Optional run label.
- Option to duplicate the previous Run.

### 5.4 Tyre data

Tyres are displayed according to their physical position on the kart:

```text
Front Left (FL)     Front Right (FR)
Rear Left (RL)      Rear Right (RR)
```

For each tyre, the first version should support:

- Cold pressure.
- Hot pressure.
- Cold temperature.
- Hot temperature.

The first version will not divide tyre temperature into inner, middle, or outer readings. Each tyre has one cold temperature and one hot temperature.

Proposed initial units:

- Pressure: PSI.
- Temperature: °C.

Units should be treated as a configurable product decision, even if the first version initially defaults to PSI and °C.

Optional tyre fields to validate during testing:

- Tyre manufacturer/model or compound.
- Tyre set identifier.
- Approximate tyre age or accumulated laps.

### 5.5 Chassis setup

Proposed initial setup fields:

- Front track width or spacer configuration.
- Rear track width.
- Front ride height.
- Rear ride height.
- Front toe.
- Front camber.
- Caster.
- Axle type.
- Rear hub configuration.
- Front torsion bar setting.
- Seat stay configuration.
- Front sprocket/engine sprocket.
- Rear sprocket.
- Calculated or entered gear ratio.
- Wheel/rim type.
- Free-form setup notes.

These fields are deliberately provisional because no existing paper or spreadsheet setup sheet is available. The first track test will determine which fields are useful, missing, or unnecessary.

The following chassis fields are explicitly excluded from the first version because they are not applicable or not required for this kart:

- Rear camber.
- Rear toe.
- Seat position.
- Steering wheel settings.
- Stiffness setting.
- Rear anti-roll bar.
- Brake bias.

### 5.6 Performance data

- Fastest lap time.
- Average lap time, when available.
- Finishing position, when applicable.
- Number of laps.
- Optional result notes.

### 5.7 Driver feedback

The first version should allow quick structured feedback plus free text:

- Balance: Understeer, Neutral, or Oversteer.
- Grip level: Low, Medium, or High.
- Braking: Poor, Acceptable, or Good.
- Corner entry notes.
- Mid-corner notes.
- Corner exit/traction notes.
- General driver comments.

The exact labels and rating style will be adjusted after practical use.

## 6. Intended user flow

### 6.1 Opening the application

The home screen should prioritize immediate action:

- Resume the most recent active Event.
- Create a new Event.
- Open a recent Event.

### 6.2 Recording at the circuit

```text
Open or resume Event
→ Open the current Session
→ Tap “+ Run”
→ Optionally duplicate the previous Run
→ Enter pre-run tyre pressure and setup
→ Go on track
→ Enter hot pressure, tyre temperature, lap time, and feedback
→ Data auto-saves
→ Add the next Run
```

### 6.3 Reviewing data

The user should be able to:

- View all Sessions in an Event.
- Expand a Session to see its Runs.
- Open and edit any previous Run.
- Compare two Runs side by side.
- Identify what changed between the compared Runs.
- Export Event data for backup or later analysis.

## 7. Proposed screens

### Home

- Resume current Event.
- New Event button.
- Recent Events list.
- Backup/import access.

### Event view

- Event conditions and notes.
- Session list.
- Prominent `+ Session` action.
- Event options menu with a Delete Event action.
- Deleting an Event also deletes every Session and Run contained within it.

### Session view

- Session information.
- Run list with summary values.
- Prominent `+ Run` action.
- Duplicate-last-Run option.
- Session options menu with a Delete Session action.
- Deleting a Session also deletes every Run contained within it.

### Run editor

- Tyres.
- Chassis setup.
- Performance.
- Driver feedback.
- Notes.
- Visible auto-save status.

The form may use collapsible sections, but frequently entered tyre values should remain quick to reach.

### Compare view

- Select two Runs.
- Show tyre measurements side by side.
- Highlight changed setup values.
- Show lap-time and feedback differences.

### Data and settings

- Export all data.
- Export one Event.
- Import a backup.
- Unit preferences.
- Theme preference.
- Data deletion with explicit confirmation.
- Track Library management.

### Track Map Notebook

- Reusable Tracks and multiple Layouts.
- Built-in circuits, added from a picker in the Track Library: PF International (Full Layout)
  and Whilton Mill (International). Each ships a generated OpenStreetMap-based schematic with
  lap-ordered corner labels; any other Layout can use a user-supplied, locally optimised map
  image.
- A built-in circuit already in the library is listed as added and cannot be added twice.
- Built-in Layouts are stamped with a key and an artwork version. Records without a map are
  backfilled on app startup and out-of-date artwork is replaced; a map the user uploaded is
  never overwritten.
- Built-in map attribution and the ODbL licence link are shown beneath the map.
- Zoom and pan on mobile and desktop: pinch to zoom on touch, ctrl or cmd with the wheel on a
  pointer device, plus the on-screen zoom controls. The point under the fingers or cursor
  stays put as the zoom changes.
- In, Mid, Out, Brake, Gas and Others markers: the phases of a corner, the two pedal inputs,
  and a catch-all for anything that is neither.
- Permanent general/dry/wet reference notes, and general notes for the Layout as a whole.
- Optional saved Layout on each Event.
- Session-specific observations that never overwrite permanent notes.

## 8. Interaction and visual principles

- Mobile-first and portrait-first.
- Large touch targets suitable for use at the circuit.
- High contrast for outdoor sunlight.
- Use the selected **Option B: daylight engineering notebook** visual direction.
- Use a warm white or very light grey background with restrained blue accents.
- Use dark, highly legible text and clean engineering-style data cards.
- Light theme is the first-version default because trackside sunlight readability is the priority.
- A dark theme may be added later, but it is not required for the first version.
- Numeric inputs should open an appropriate numeric keypad.
- Minimize typing by using sensible defaults, choices, and duplication.
- Never require every field before allowing a record to be saved.
- Auto-save after changes and show a clear saved/saving state.
- Show the Event, Session, and Run context clearly at all times.
- Confirm destructive actions such as deleting a Run, Session, or Event.
- Destructive actions must state which nested records will also be deleted and require a second explicit confirmation.
- Preserve partially completed entries if the page closes unexpectedly.

## 9. Local data and offline behavior

### Local persistence

The first version will store structured records in the browser on the current device. No account is required.

Expected behavior:

- Closing and reopening the application preserves data.
- Refreshing the page preserves data.
- Updating the deployed application should preserve data when the domain remains unchanged and the data format remains compatible.
- A different browser or device will not automatically contain the data.
- Clearing browser/site data may remove the records.
- Private/incognito browsing must not be used for permanent records.

### Backup and recovery

Because there is no cloud account, backup is a first-version requirement rather than an optional enhancement.

- JSON export will provide a complete restorable backup.
- JSON import will restore a compatible backup.
- CSV export will provide human-readable tables for spreadsheets and analysis.
- Import must validate the file before replacing or merging data.

### Offline use

The application should be installable as a Progressive Web App where the device/browser supports it. Once loaded, the core interface and local data functions should continue to work without a network connection.

## 10. Technical direction

This section records the current direction, not an irreversible implementation decision.

- Source code stored locally in this project folder.
- Git used for version history after explicit initialization.
- Private GitHub repository used as the remote source repository.
- Vercel used for preview and production deployments.
- Mobile-first client-side web application.
- TypeScript for maintainability and safer data changes.
- IndexedDB browser database for local structured records.
- PWA support for installation and offline use.
- No server database or authentication in the first version.

The first implementation uses Next.js 16, React 19, and TypeScript. It is configured as a static export, so the initial release does not require server rendering or backend functions.

Future cloud features should prefer portable standards and services where practical. Platform-specific services should only be introduced when they provide a clear benefit.

## 11. Deployment workflow

Proposed development and release process:

1. Maintain this design document as the agreed product reference.
2. Produce a low-detail mobile wireframe.
3. Confirm the main recording workflow.
4. Create the local application project.
5. Implement and test the first usable version locally.
6. Test mobile layouts, auto-save, offline behavior, and recovery.
7. Initialize Git after explicit approval.
8. Create/connect a GitHub repository after explicit approval.
9. Commit and push only after explicit approval for each action.
10. Connect the repository to Vercel.
11. Use Vercel preview deployments for review.
12. Publish the approved production version.
13. Conduct a real trackside trial and revise this document.

## 12. First-version acceptance criteria

The initial release is successful when:

- A new Event, Session, and Run can be created on a phone.
- Multiple Runs can be recorded within a Session.
- The previous Run can be duplicated and edited.
- Four-corner tyre pressure and temperature data can be recorded.
- Chassis setup, lap time, and feedback can be recorded.
- All changes save automatically.
- Records survive refresh and browser restart in normal browsing mode.
- The application remains usable without a network connection after initial setup.
- Two Runs can be compared.
- Data can be exported, deleted, and restored from a valid backup.
- The layout remains usable in bright, trackside conditions.
- A deployment update does not unintentionally erase existing local records.

## 13. Open decisions

The following decisions remain open and should be resolved before or during the first prototype:

- Final product name and icon.
- Default language and whether bilingual support is required.
- Final pressure and temperature units.
- Exact kart chassis setup fields and terminology.
- Whether pressures and temperatures need timestamps.
- Whether pre-run and post-run conditions should be separate form stages.
- How Run comparison should select and display differences.
- The precise frontend framework and supporting libraries.

Resolved:

- CSV export uses a single file containing three labelled tables — Events/Sessions/Runs, Track reference markers, and Session track observations — separated by a blank row. The Run table keeps its original shape so existing spreadsheets continue to work.

## 14. Future expansion candidates

Possible later phases include:

- Saved setup templates.
- Custom user-defined setup fields.
- Trend charts and tyre-temperature visualizations.
- Cloud backup and device synchronization.
- User authentication.
- Driver, mechanic, and team roles.
- Shared live Event data.
- Weather and track-condition integrations.
- Timing-system import.
- Photo and document attachments.
- Setup-to-performance correlation analysis.
- AI-assisted observations and recommendations.

## 15. Change log

### Implemented prototype v1.8 — 2026-08-17

- Added Simplified Chinese for the whole interface, switched from a button in every top bar and
  remembered in the browser. Roughly 300 strings.
- Chinese follows the convention already set by `USER_GUIDE.zh-CN.md`: the structural nouns of
  the data model — Event, Session, Run, Setup, Marker, Track, Layout — and product names such
  as Track Library stay in English, with Chinese prose around them. That is how the owner
  writes about the app; inventing Chinese equivalents would not match how he or the paddock
  talk about it.
- Dictionary keys are the English source strings, so anything untranslated falls back to
  readable English rather than a missing-key placeholder.
- Values written into records are never translated. `Full Layout` and `PF International` are
  record values, and marker types and enumerations are stored in English with only their label
  translated, so switching language cannot alter stored data or a CSV export.
- Dates use the chosen language's locale.
- The language is exposed through `useSyncExternalStore` with a server snapshot rather than read
  in an effect. The prerendered markup has no access to localStorage, and reading it in an effect
  would mean calling setState there, which cascades a render.
- `lib/i18n.test.ts` reads the components and fails if any string passed to `t()` lacks a
  translation, if a placeholder is lost in translation, or if a stored record value is ever
  added to the dictionary.

- Rewrote `USER_GUIDE.zh-CN.md` against the Chinese interface. It previously quoted English UI
  labels throughout, because it was written when the interface was English only. It now also
  documents the language switch, the reduced marker types, corner numbering, placing a marker by
  corner, Layout general notes, pinch zoom, and the three-table CSV. The screenshots still show
  the English interface, which the guide states.

### Implemented prototype v1.7 — 2026-08-16

- Added an "Others" marker type for anything that is neither a phase of a corner nor a pedal
  input. It is marked `*` rather than a letter, since every letter would either collide with a
  phase or read as one, and coloured outside the brake-to-throttle sequence.
- Legacy Hazard, Overtaking and Focus markers now migrate to Others rather than Mid, which is
  what they always meant. Their original type is still recorded in the marker's general note.
  A marker migrated before this change stays as Mid; the note preserves the original either
  way, so no second migration is warranted.
- Removed the auto-save note under the Layout's general notes. It described where the notes
  were kept rather than telling the user anything they needed at the circuit.

### Implemented prototype v1.6 — 2026-08-16

- Added pinch to zoom on touch, and ctrl or cmd with the wheel on a pointer device. Plain
  scrolling still scrolls the page, matching what browsers and map tools already do. The point
  under the fingers or cursor is held in place as the zoom changes, so the map does not drift
  away mid-gesture. Both gestures call preventDefault, so their listeners are attached
  directly rather than through React props, which are passive.
- A marker can now be placed anywhere on the map. Corner labels and existing markers stop
  click propagation, so while placing they were dead zones scattered across the map; they are
  now inert until placement finishes. Placing on a named corner is still available through the
  "At corner" picker.

### Implemented prototype v1.5 — 2026-08-16

- Reduced the marker types to In, Mid, Out, Brake and Gas: the phases of a corner plus the
  two pedal inputs. The previous eight mixed corner phases with things that were not phases
  at all, such as Hazard and Overtaking.
- Markers already stored under the old types migrate on load and on backup restore. Turn-in,
  Apex, Exit and Braking map straight across; Corner, Hazard, Overtaking and Focus have no
  equivalent, so they become Mid and their original type is written into the marker's general
  note rather than being lost.
- Added general notes to the Layout, at the foot of the map page, for anything about the
  circuit as a whole rather than about one marker. Session track summaries are unchanged and
  remain separate.

### Implemented prototype v1.6 — 2026-08-19

- Reduced Whilton Mill to the International layout. The National, Indy and Mill circuits and
  their artwork are removed; only the circuit actually driven is shipped.
- `scripts/build-whilton-maps.mjs` now builds the one map. The closed-way branch and its
  pit-exit lap-start rule went with it, since only the Mill cadet circuit reached them. The
  committed Overpass extract is unchanged: it still holds the National and Indy relations, which
  chain the same way, so restoring either is one more entry in `CIRCUITS`.
- Regenerating after the reduction produces a byte-identical `whilton-mill-international.svg`,
  which is the check that removing the others changed nothing about the one that stayed.
- The 180-degree corner split is kept even though this circuit never triggers it — its sharpest
  group turns 141 degrees. A sweep long enough to need splitting has no straight inside it for
  `MERGE_GAP` to break at, so nothing else would catch one.
- `refreshBuiltInMaps` leaves a layout keyed to a dropped circuit alone rather than falling
  through to the name match. Anyone who added Whilton Mill from v1.5 keeps all four layouts with
  their maps and markers intact; the three extra ones simply stop receiving artwork updates and
  can be deleted from the Layout page.

### Implemented prototype v1.5 — 2026-08-19

- Added Whilton Mill as a second built-in circuit, with all four of its layouts: International
  (1,040 m), National (845 m), Indy (665 m) and Mill (441 m). Each is a generated schematic
  carrying its own lap-ordered corner labels, start/finish line and racing-direction arrow.
- `lib/track-map/built-in-maps.ts` replaces `built-in-map.ts`. The single hard-coded PF
  International map became a registry of tracks and layouts, and `refreshBuiltInMaps` now
  identifies a stored layout by a `builtInLayoutKey` written onto the record rather than by
  matching the track and layout names. Records created before keys existed have none, so PF
  International keeps a name-match fallback; that fallback is deliberately not extended to
  Whilton Mill, where a name match could only ever capture a track the user built themselves.
- `scripts/build-whilton-maps.mjs` generates the four maps and their corner lists in one pass
  from `scripts/data/whilton-mill-osm.json`, a committed Overpass extract. Artwork and labels
  come out of the same run, so they cannot drift apart, and the build needs no network.
- Lap order is taken from the ways' `oneway` tagging rather than inferred, so the direction
  arrow shows the real racing direction. Each lap starts where the pit lane rejoins the
  circuit, which is the Home Straight for the three main layouts.
- Corner detection matches the PF International thresholds, with one addition: a continuous
  sweep of more than 180 degrees is split into equal parts. Whilton Mill's tighter circuits
  each contain a curl of 190 to 235 degrees with no straight inside it, which no distance-based
  merge setting separates and which is not one corner to a driver.
- Lap lengths on the maps are the measured OpenStreetMap centreline and are labelled as such.
  They run shorter than the figures the circuit publishes — 441 m against a quoted 450 m for
  the Mill circuit, and further off for the National — so presenting them as official distances
  would have been wrong.
- Layout direction is recorded as Clockwise, taken from the loop's signed area rather than
  assumed.
- Fixed a latent overflow in `.item-list`: with no explicit grid column the track was sized by
  its content, so a long track name or layout list widened every row past its container and
  pushed the chevron off screen.

### Implemented prototype v1.4 — 2026-08-16

- Removed the corner names added in v1.3. Corners are identified by number alone. At map
  scale a name like "Bobby Game Corner" is wider than the gap between corners and painted
  over its neighbours, and moving the names off the map into a list underneath was not worth
  the space it cost. The fifteen-corner numbering is unaffected.

### Implemented prototype v1.3 — 2026-08-16

- Renumbered the built-in PF International corners to the owner's own scheme: fifteen corners
  in lap order, starting from three corners he identified on the Sector 1 approach.
- `scripts/derive-corners.mjs` now accepts hand-placed corners as an input, snaps them onto
  the track centreline and merges them into the lap order with the detected ones. Curvature
  detection only finds bends sharp enough to stand out, but a circuit also names long sweeping
  sections that never reach that threshold, so detection alone was never sufficient.
- PF International's own corner numbering is deliberately not used. Their circuit guide names
  ten corners (Turn 1 "Litchfield Bridge", Turn 7 "Fullerton Esses", Turn 8 "Bobby Game
  Corner", Turn 9 "Fletcher's Loop"), but their published map is a stylised diagram rather
  than a survey: fitting its corner positions to this map's geometry over every rotation,
  scale and mirror left a mean residual of 46 units on a 760-wide map and collapsed ten turns
  onto six positions, so no reliable automatic mapping exists.

### Implemented prototype v1.2 — 2026-08-16

- Added lap-ordered corner labels (T1–T12) to the built-in PF International layout, derived
  from the map's own path geometry by `scripts/derive-corners.mjs` so the labels cannot drift
  away from the artwork. Corners are stored on the Layout, so they are backed up and restored
  with everything else.
- A marker can now be placed on a named corner, from a picker or by tapping the corner label,
  and takes that corner's name. Tapping anywhere on the map still works, for bumps,
  overtaking spots and anything else between corners. Moving a marker accepts a corner too.
- Marker deletion is now reachable from the normal Reference view, not only from Edit map.
  Moving a marker still requires Edit map, so nothing shifts by accident at the circuit.
- Replaced `window.confirm` for marker, Layout and Track deletion with the same confirm
  dialog used for Events, Sessions and Runs. It states what else will be removed, which the
  native dialog could not, and native dialogs are the least reliable part of an installed PWA.
- Renamed the map's `Reset` control to `Reset zoom` and disabled it at 100%. It only ever
  reset zoom, but read as "reset the map" and appeared inert when already at 100%.

### Implemented prototype v1.1 — 2026-08-16

- Reframed the built-in PF International map from a 1200x900 landscape canvas to a cropped
  portrait one, so the circuit fills 81.8% of the canvas width instead of 51.8% and renders
  roughly 1.6 times larger on a phone. The legend, which overlapped the bottom-left loop,
  moved clear of the track.
- Added a version stamp and a startup refresh for app-supplied maps. The artwork is copied
  into IndexedDB on first use, so without this a corrected map never reached a device that
  had already stored the old one. A map the user uploaded is never overwritten.
- Read built-in map dimensions from the file's own viewBox instead of hard-coding them.
  Marker positions are fractions of the asset box, so a stored size that disagreed with the
  artwork would have letterboxed the image and drifted every marker.
- Gave the built-in map a dark colour scheme, so it no longer shows as a bright white panel
  in the dark theme. It follows the device colour scheme; an SVG shown through an image
  element is its own document and cannot see the app's manual theme toggle.
- Removed the circuit name from inside the map artwork. The app already shows it in the top
  bar and as the page heading, so it appeared three times on one screen.
- Added a Vitest suite covering the data layer: backup round-trip, CSV export, the storage
  schema upgrade, and built-in map replacement. `npm test` runs it.

### Implemented prototype v1.0 — 2026-08-15

- Extended CSV export with Track reference marker and Session track observation tables, so the export again covers the full dataset rather than only Events, Sessions and Runs.
- Made the auto-save indicator wait for every in-flight write. App data and Track Map data save on separate debounces, so the faster save previously reported "Saved" while the other was still writing.
- Tied map object-URL lifetime to the mounted image element, so replacing map images during a long trackside session no longer leaks one object URL per image.
- Split the Track Map feature into the component modules named in section 7 — Track Library, Map Workspace, Map Canvas, Marker Sheet, editors and shared primitives — instead of a single feature file.

### Implemented prototype v0.8 — 2026-08-15

- Added the integrated Track Map Notebook and Track Library.
- Added Track and Layout creation, editing and confirmed cascading deletion.
- Added locally optimised map image upload, mobile/desktop zoom and pan, and protected Reference/Edit modes.
- Added multiple marker types with add, move, edit and delete workflows plus general, dry and wet reference notes.
- Added optional saved Track Layout selection to Event creation/editing and Session Track notes.
- Added Session-specific marker observations and overall Session map summaries without changing permanent reference notes.
- Upgraded IndexedDB with separate Track, Layout, Visit and map-asset stores while preserving the existing app store.
- Extended full JSON backup and restore to include Track Maps and embedded map images with record counts in the restore confirmation.

### Implemented prototype v0.9 — 2026-08-15

- Added a generated PF International owner-driver schematic based on OpenStreetMap raceway geometry, with visible ODbL attribution and source documentation.
- Added automatic startup backfill for legacy PF International Full Layout records that do not yet have a map image.

### Implemented prototype v0.5 — 2026-08-13

- Expanded CSV export to include the complete Event, Session, Run, tyre, setup, performance and feedback dataset, including calculated pressure and temperature gains.
- Added a confirmation and automatic version migration to JSON restore so existing version 1 browser data remains compatible.
- Added Session editing without affecting its existing Runs.
- Added blank Run creation, one-tap previous Run duplication and arbitrary historical Run copying.
- Expanded Run comparison to every recorded field, grouped by category, with a differences-only filter and fastest-lap delta.
- Added reusable chassis setup templates that can be saved from and applied to any Run.
- Added dedicated iPhone installation instructions, Apple touch artwork and standards-based PNG manifest icons.

### Implemented prototype v0.4 — 2026-08-12

- Created the working Next.js and TypeScript application.
- Implemented Event, Session and Run creation, editing and cascading deletion.
- Implemented IndexedDB auto-save, JSON backup/restore and CSV export.
- Implemented Run duplication and side-by-side Run comparison.
- Added a production PWA manifest, service worker and static Vercel-ready build.
- Verified the core flow, refresh persistence, deletion warnings and 320 px mobile layout in a browser.

### Draft v0.3 — 2026-08-12

- Added Event and Session deletion to their respective options menus.
- Defined cascading deletion: deleting an Event removes its Sessions and Runs; deleting a Session removes its Runs.
- Required a clear irreversible-action warning and a second explicit confirmation before deletion.

### Draft v0.2 — 2026-08-12

- Selected Option B, the daylight engineering notebook visual direction.
- Set a light, high-readability interface with restrained blue accents as the first-version default.
- Simplified each tyre to cold/hot pressure and cold/hot temperature readings.
- Confirmed front-only toe and camber fields.
- Explicitly excluded rear camber, rear toe, seat position, steering wheel settings, general chassis stiffness, rear anti-roll bar, and brake bias.

### Draft v0.1 — 2026-08-12

- Established the `Event → Session → Run` hierarchy.
- Recorded the recommended first-version fields and workflow.
- Confirmed local, account-free storage for the initial release.
- Confirmed mobile-first, offline-capable behavior.
- Confirmed GitHub source management and Vercel deployment direction.
