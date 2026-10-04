# Project review — 4 October 2026

Reviewed the application repository `AlexLiaoooo/karting-data-recording-website`,
checked out into this folder. Previously this folder was empty and Git commands
resolved to the parent `karting-tools-notes` repository. The app now has its own checkout.

## Assessment

The app has a sound foundation for a personal trackside tool: a static,
account-free deployment; a clear Event → Session → Run model; shared pressure,
gearing and lap calculations; IndexedDB persistence; portable backups; and
substantial regression coverage. The most important remaining work concerns
failure recovery and competing writers, rather than adding features.

Review scope: application shell and forms, recording/comparison workflows,
data types and migrations, IndexedDB reads/writes, backup/restore, CSV,
Track Library and marker interactions, map generation and assets, translations,
PWA installation and caching, dependencies, build setup, tests and documentation.
This was a source review plus local automated and browser checks, not a
physical iPhone test or a review of the live Vercel configuration.

## Small improvements applied

| Improvement | Reason | Files |
| --- | --- | --- |
| Local calendar dates | UTC date slicing chose yesterday during the early morning in China, or tomorrow late in the day west of UTC. Event defaults and export filenames now use the device date. | `lib/format.ts`, `app/page.tsx` |
| Run numbering after deletion | With surviving Runs 1 and 3, array length + 1 created another Run 3. The next Run now follows the highest surviving number. | `lib/types.ts`, `app/page.tsx` |
| Lap rounding at minute boundaries | 119.9996 seconds formatted as `1:60.000`, which the parser rejects. It now formats as `2:00.000`. | `lib/lap-time.ts` |
| Readable tyre decimals on phones | At 390px, a tyre input was only 62px wide, with 38px reserved for an overlaid unit. `10.5` was clipped. Tyre units now sit below the input, leaving the reading visible. | `app/globals.css` |
| Chinese session marker prompts | Two labels bypassed the existing translations. They now use the dictionary without translating stored values. | `components/track-map/MarkerSheet.tsx` |
| Bounded weather requests | The location request already timed out, but the subsequent weather fetch could stay pending. It now has a 12-second timeout. | `app/page.tsx` |
| Download lifecycle | The download link is attached while clicked, and its Blob URL remains available briefly before cleanup, avoiding immediate revocation during download initiation. | `app/page.tsx` |
| Offline cache handling | Workers delete only old `kart-data-` caches, claim clients after cleanup, keep successful cache writes alive, and fall back to the saved shell on server errors without caching those error pages. | `public/sw.js`, `scripts/generate-sw.mjs` |
| Dependency and lockfile repair | The original lockfile failed `npm ci`. Next and its lint configuration are pinned to 16.3.8. Sharp is explicitly declared at 0.35.4 for the icon-generation script as well as patched image tooling. | `package.json`, `package-lock.json` |

Regression coverage was added for local dates, numbering gaps, lap rounding,
and both the fallback and generated production service workers.

## Remaining findings, in priority order

### P1 — Validate nested backups before offering replacement

`lib/database.ts:33` validates the version and the existence of an events array,
then casts the records. `lib/track-map/backup.ts:54` checks collection arrays but
does not validate their full contents or references.

Reproduced without touching browser data:

- `{version: 2, events: [{}]}` is accepted and gains an empty sessions array.
- An Event whose name is the number `42` is also accepted.
- `{version: 2, events: [null]}` throws while reading `sessions`.

An accepted malformed backup can reach the replacement confirmation and then
crash rendering or autosave after existing data has been replaced. Validate
Events, Sessions, Runs, tyre/setup objects, templates, layouts, markers and
visits before confirmation, including unique IDs and usable relationships.
Keep explicit compatibility rules for genuine older backups. Do not silently
drop invalid records to make a backup appear valid.

### P1 — Keep a failed startup read from enabling replacement writes

`app/page.tsx:273` reads both datasets through `Promise.all`. If either fails,
the catch records an error, but the finally block still marks hydration complete
and allows the app to open with its initial empty datasets. A later edit can
then save those empty datasets over records that were never loaded.

The normal home screen does not display the save error; that indicator is in
the Run editor. Add a distinct load-failure state with retry/recovery actions,
and enable normal edits only after successful hydration. Preserve any dataset
that was read successfully. This finding follows the control flow; storage
failure was not injected in the browser during this review.

### P1 — Restore both datasets atomically and report persistence success

`app/page.tsx:743` replaces React state and immediately says “Backup restored”.
App and Track Map writes subsequently run on separate debounce timers and
separate IndexedDB transactions. A quota error or interruption can leave one
half restored and the other unchanged.

Write the entire restore across all stores in one IndexedDB transaction,
coordinate outstanding saves, and update the UI/report success after commit.
Add a failure-injection test showing that the old data survives an aborted
restore. This is a persistence change requiring more care than the quick fixes.

### P2 — Protect records when two tabs or windows are open

Each page loads its own snapshot. `saveData` writes the whole app document,
and `saveTrackMapData` clears/repopulates its collections. There is no revision
check or coordination between tabs. A stale tab can therefore replace another
tab's newer edits. Choose a single-writer policy or conflict detection, with
notifications between tabs, before promising safe concurrent editing.
This is a source-level finding; concurrent writes were not exercised here.

### P2 — Finish keyboard and screen-reader handling for dialogs

Event/Session/Track/Layout forms use visual modal sheets without dialog roles.
Dialogs that do have `aria-modal` still have no focus trap or Escape handling,
and opening/closing them does not consistently transfer and restore focus.
For example, the Event form's browser snapshot still exposes the background
home controls. A shared dialog primitive should provide naming, focus
containment/restoration, dismissal and background inertness. Keep confirmation
focus on the safe action.

### P2 — Plan a safe service-worker update handoff

Both workers still call `skipWaiting`, and activation removes the old app
caches while existing pages may be using the preceding build. The complete
precache and static assets help, but a real two-build rollout with an old tab
open has not been verified. Test that scenario and consider an update prompt
or retaining the previous build cache until its clients close.

### P2 — Development dependency advisories remain

After the patch updates, `npm audit --omit=dev` reports **zero** vulnerabilities.
The full audit still reports 10 affected development packages (8 high,
2 moderate), including lint glob dependencies and the Vitest mocker.
Several have compatible updates; the lint glob chain currently leads npm to
suggest an incompatible downgrade of the Next lint configuration. Review these
separately instead of applying `npm audit fix --force`.

The patched production findings were checked against the
[Next maintainer advisory](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j)
and [Sharp maintainer advisory](https://github.com/lovell/sharp/security/advisories/GHSA-rgj7-g3m4-5g8c).
The Next advisory describes server-side image generation; this code exports a
static app and does not implement that endpoint. Package audit findings alone
do not establish that the deployed site was exploitable.

### Maintenance follow-ups

- Add CI running clean installation, lint, tests and the production build. No
  GitHub Actions workflow is committed in this checkout.
- Split `app/page.tsx` into recording screens and shared form primitives as
  those parts next change. A broad rewrite would add risk without fixing a
  current trackside problem.
- Handle unavailable localStorage in the theme/language helpers. IndexedDB is
  the record store, so a failed preference write should not crash the interface.
- Decide how CSV should treat free text beginning with spreadsheet formula
  characters. Quoting escapes delimiters but does not force literal text in
  spreadsheet applications; preserve negative numeric measurements.
- Fix the documented preview command: this project exports static files, while
  its `start` script calls `next start`. The review used a static file server.

## Verification

- **241 tests passed across 14 files.** Includes existing backups, CSV,
  migrations, circuit generators, marker mappings, calculations and translations.
- **Lint passed.**
- **Production build passed on Next 16.3.8.** Generated worker precaches 36 files.
- **Clean-install dry run passed** after the lockfile and dependency changes.
- **Production dependency audit: zero vulnerabilities.** Development findings
  are recorded above.
- **Browser smoke check:** create Event → Session → Run, enter cold/hot tyre
  pressures, observe Saved, switch Chinese, reload, resume and verify stored
  values `10.5` and `12.5`. No reported runtime errors or framework overlay.
- **Offline browser check:** worker activated and cached the app; forced
  offline reload displayed the saved Event and navigation controls.
- **Mobile:** 390px and 320px Run views did not overflow horizontally. The
  final 390px tyre inputs show the full decimal values without internal clipping.

The browser tests used isolated local sessions and temporary records. No live
site records were modified. Weather-provider responses, physical iOS download
behavior, storage quota failure, concurrent tabs and a deployed two-build update
remain unverified. All changes are local and uncommitted; nothing was pushed or
deployed as part of this review.

Final mobile screenshot: [tyre readings at 390px](docs/images/review/2026-10-04-tyres-mobile.png).
