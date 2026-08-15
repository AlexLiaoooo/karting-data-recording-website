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
- PF International Full Layout includes a generated OpenStreetMap-based schematic; other Layouts can use a user-supplied, locally optimised map image.
- Existing PF International Full Layout records without a map are backfilled with the built-in schematic on app startup; existing custom map assets are never overwritten.
- Built-in map attribution and the ODbL licence link are shown beneath the map.
- Zoom and pan on mobile and desktop.
- Corner, Braking, Turn-in, Apex, Exit, Hazard, Overtaking and Focus markers.
- Permanent general/dry/wet reference notes.
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
