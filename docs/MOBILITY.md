# Stretching section: status and limitations

The stretching, mobility and bodyweight-strength section lives in `src/mobility/`
and is opened from the **Stretch** tab. It is free, has no account, ads, tracking
or network calls, and keeps its data separate from the lift tracker.

## Data and the lift tracker

| Storage key | Owner | Touched by the stretching section |
|---|---|---|
| `workout-tracker-v6`, `exercise-config-v1`, `nutrition-v1`, `weight-log-v1`, `ui-prefs-v1` | Lift tracker | Never written. Read only when you make a full backup file. |
| `mobility-v1` | Stretching: settings, custom routines, favorites, history, reminders | Yes |
| `mobility-session-v1` | Stretching: the session in progress | Yes |

`tests/backup.test.ts` seeds the five tracker keys and checks they are byte-for-byte
unchanged after every stretching storage operation, including "Delete stretching data".

Data is stored in the browser on one device. It is not a backup. Clearing site data
erases it, and on iPhone a Home Screen app has storage separate from Safari.
**Data → Export Backup** (tracker) and **Settings → Back up everything** (stretching)
both write one file holding everything. Restore tracker data from the Data tab and
stretching data from either screen.

## Completion checklist

Done and covered by automated tests (`npm test`, 66 tests):

- [x] 193 catalog entries, unique ids, group sizes as specified, complete text and metadata
- [x] An illustration pose for every entry, none orphaned
- [x] 121 prepared routines in nine families and 8 seven-day series; no harder movement in an easier routine; every exercise is used somewhere
- [x] Timeline: sides, side changes, transitions, per-transition overrides, repetition estimates
- [x] Player engine: timestamp timing, pause, previous, next, restart, end early, suspension and reload detection, single history record per session
- [x] Dates: timezone-aware day assignment, midnight, daylight-saving boundaries
- [x] Streaks, 21-day consistency gauge, weekly and monthly goals
- [x] Planner: the three example requests, every constraint type, impossible requests explained
- [x] Backup and restore round trip, damaged-file handling, routine files, CSV
- [x] Reminder scheduling, quiet hours, streak reminder

Done and checked by hand in headless desktop Chrome (`scripts/shots.mjs`, `scripts/offline.mjs`):

- [x] Today, Library (search, filters, five views), routine, exercise and series screens
- [x] Manual builder: pick, reorder (drag handle and Move Up/Down), per-item time, unit, transition, duplicate, cover, preview, save
- [x] Request planner with visible interpretation, regenerate, exclude, edit, save, export
- [x] Player, instructions sheet, interruption prompt, summary with note and effort
- [x] Progress stats, calendar, breakdown, history edit, manual entry, undoable streak repair
- [x] Settings: appearance, text size, reduced motion, audio, timing, preferences, reminders, install help, data, help
- [x] Light and dark, larger text, 320 px, phone and desktop layouts
- [x] Loads and shows all 193 illustrations with the network off after one visit

Not done, or not verified:

- [ ] **Nothing has been tested on a real iPhone.** Audio, speech, screen wake, Home Screen
      install, notifications and behaviour when the phone locks are implemented against the
      web standards but unverified on the target device.
- [ ] **Demonstration videos: none.** Every entry is marked "no video". Illustrations and written steps are the reference.
- [ ] **Illustration review.** All 193 figures are generated from joint angles. Two passes have been
      made on contact sheets (figure redrawn with tapered limbs; forward folds, folded-leg floor poses,
      twists, side-lying poses and neck close-ups reworked). Still weak: the front-view wide-leg
      movements (`toe-touch-twist`, `wide-leg-toe-touches`, `wide-leg-torso-circles`), twists in general
      (a flat view cannot show rotation), and the neck close-ups. Fix a pose with `scripts/poses.py`
      or directly in `src/mobility/data/poses.ts`, check it with `scripts/view.sh <ids> out.png`,
      then `npm run art:export`.
- [ ] **Exercise text has not been checked against outside sources.** It was written from general
      knowledge. Treat it as ordinary exercise guidance, not medical advice.
- [ ] Screen-reader pass with VoiceOver. Labels, roles and live regions are in place but untested with a real reader.
- [ ] The Stretch-tab link from the tracker's "Bend" checklist items is not wired; they remain plain checkboxes.
- [ ] Only English is shipped. Text goes through `t()` in `src/mobility/i18n.ts`; catalog text is in the data files.

## Platform limits

- **Reminders only fire while the app is open.** A web app with no push server cannot wake itself.
  They show as an in-app banner and, if allowed, a system notification. On iPhone, notifications need the Home Screen app.
- **Timers and sound stop when the phone locks or the app is in the background.** On return the app
  says how long it was away and asks whether to resume or count the time. Gaps under 10 seconds are counted automatically.
  Missed cues are never played late.
- **Sound needs one tap first** (browser rule) and follows the phone's silent switch.
- **Screen wake** uses the Wake Lock API where the browser has it.
- **Offline** needs one online visit after each update so the files can be cached. The tracker's
  web fonts are not cached and fall back to system fonts offline.

## Working on it

```bash
npm test                  # unit tests
npm run art:sheet neck    # contact sheet (sheet.html) of poses whose id contains "neck"
npm run art:export        # rewrite assets-src/illustrations/*.svg and the manifest
node scripts/shots.mjs http://localhost:4173/ /some/dir   # screenshots of a `npm run preview` build
```

Layout: `data/` catalog, poses and routines; `art/` the figure renderer; `lib/` storage,
timeline, player engine, planner, stats, backup, reminders; `ui/` screens.
