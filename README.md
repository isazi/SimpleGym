# Simple Gym

A SuuntoPlus watch app for logging gym sets and tracking rest without leaving the workout screen.

Simple Gym is deliberately minimal: no exercise names, no weight or rep entry, no menus. The app starts in a **WAITING** state. On UI2 watches, hold the top button to begin exercise 1, set 1. During a set there is no rest timer: an open-ended set timer counts up. Press the lower button to end the set and start rest. Press it again when you are ready for the next set; the set timer restarts at zero and the SETS number advances.

## Controls

| Action | UI2 watches | UI1 / lap-only watches |
| --- | --- | --- |
| Top button long press | Starts at EX 1 / SET 1, then advances to the next exercise | — |
| Lower press during a set | Ends the set, starts rest, creates a lap; SETS stays unchanged | — |
| Lower press during rest | Ends rest, starts the next set timer, advances SETS, creates a lap | — |
| Lower button long press | Same as a lower press | — |
| Lap button | — | First lap starts EX 1 / SET 1; then alternates ending a set and starting the next |

The first set of every exercise is 1, never 0. The exercise number only moves forward. There is no upper limit in normal use; the value is capped at 999 for display safety. Sets are counted separately for every exercise number. TOTAL counts sets as soon as they start, so it always keeps up with SETS.

A lower-button press while `WAITING` is ignored: use the top long press to start. Consecutive presses are accepted, even in quick succession. Presses while the workout is idle, in pre-start, or paused are ignored.

Button events are handled by the Simple Gym screen itself. Keep that screen visible and awake while you train; on other watch screens the lower button keeps its normal behaviour, and lower-button logging does not wake the display.

## Timers

### Set timer

- Starts when a set begins: the first top long press, a lower press during rest, or an exercise switch.
- Counts up from `0'00` and is open ended; there is no set limit.
- Stops when the lower button ends the set.
- No rest timer is shown while a set is in progress.

### Rest timer

- Rest length is configured in the Suunto app, not on the watch: **Rest length [s]**, from 0 to 600 seconds, default 30.
- Ending a set starts the countdown from the configured length.
- At zero the watch plays the `Interval` indication once (sound and/or vibration, depending on watch settings).
- After zero the display switches to **REST OVER** and counts up until the next lower-button press.
- Starting the next set clears the rest timer immediately.
- Rest timing follows activity duration, so pausing the workout freezes it.
- **Rest alert** can be disabled in the Suunto app. No repeat alerts are played.

## Display

UI2 watches (`n`, `o`, `q` displays):

- Current exercise number and set number at the top.
- Large state and timer in the center: `WAITING`, `SET` with its count-up timer, `REST` with the countdown, or `REST OVER` with overtime.
- Total sets and session duration at the bottom.

There are no button hints on the workout screen. Controls are documented in `description.txt` for the store and in the Controls table above. This assumes the controls are simple enough not to need constant reminders.

UI1 watches use a minimal four-field layout: exercise, current-exercise set, a single timer field, total sets, plus the session duration. The timer field shows the set count-up during a set and the rest countdown or overtime during rest. Exercise switching is not available on UI1.

## Laps and workout data

Both lower-button actions create a lap on UI2 watches with silent-lap support (`/Activity/Trigger` value 23): ending a set and starting the next set. The workout timeline therefore has lap boundaries at each set end and set start, without opening a lap view. On UI1 the system lap is the only lap; no extra lap is created. The first UI1 lap only starts set 1.

A lap created at a set end covers the set plus any rest since the previous lap; a lap created at the next set covers the rest interval. Disable autolap so only Simple Gym controls lap boundaries.

If the watch does not support silent laps (`HAS_SILENT_LAP` is 0), Simple Gym does not trigger a lap automatically. This avoids interrupting the set flow with a lap view. The set and rest tracking still work.

Two values are written to the workout log:

- `Total sets` — all sets started in the session
- `Total exercises` — number of exercise numbers with at least one set

Per-exercise values and rest timing are for the on-screen display only; logging their latest value at workout end would not be meaningful.

## End-of-session summary

After the workout, the Suunto app shows:

- **Sets** — total sets started
- **Total Exercises** — number of exercise numbers with at least one set

No summary is produced until the first set is started.

## Settings

| Setting | Type | Default | Notes |
| --- | --- | --- | --- |
| Rest length [s] | integer slider | 30 | 0–600 seconds; 0 goes straight to **REST OVER** after a set |
| Rest alert | boolean | on | Play the `Interval` indication when rest reaches zero |

Settings are read when the workout starts and when the app screen is loaded. They are stored by the SuuntoPlus runtime in `data.json` / local storage.

## Session restore

The session state is saved after every set start, set end, exercise change, and rest alert. If the watch reloads the app screen during a workout, the exercise, set number, per-exercise counts, timers, and countdown are restored. The saved session is cleared when the workout ends.

## Files

```
SimpleGym/
├── manifest.json      # app metadata, inputs, outputs, settings, templates
├── main.js            # state machine, timers, lap triggering, summary
├── t.html             # UI2 template (n, o, q displays)
├── t-legacy.html      # UI1 template (s, m, l displays)
├── data.json          # default settings
├── en.json            # English UI strings
├── description.txt    # store description
├── README.md
├── tests/
│   ├── main.test.js   # mocked-runtime test suite
│   └── run.sh         # runs the suite with JavaScriptCore
├── .vscode/
│   └── settings.json  # pins the build language to English
└── media/
    ├── banner.png          # 600x300 store banner
    ├── screen.png          # 466x466 rest screen
    ├── screen-ready.png    # 466x466 set screen
    └── screen-over.png     # 466x466 rest-over screen
```

The media images are renders of the templates at the Suunto Race display size. Replace them with simulator screenshots before publishing if you want pixel-exact store artwork.

## Development

Requirements:

- Visual Studio Code with the **SuuntoPlus Editor** extension
- A Suunto watch that supports SuuntoPlus apps (optional for simulator work)

Open this folder in VS Code. The extension reads `manifest.json` and `data.json`, and the SuuntoPlus simulator can run the app without a watch. The simulator lets you switch between displays `q`, `o`, `n`, and the UI1 displays, and lets you send button events.

There is no build script in this repository. Use the SuuntoPlus Editor commands to build and deploy the app.

The state machine can be exercised without a watch using the mocked-runtime tests:

```sh
./tests/run.sh
```

This requires macOS JavaScriptCore (`jsc`), which ships with macOS and Xcode. The tests substitute the compile-time tokens, run all lifecycle callbacks, and check set logging, laps, timers, alerts, restore, UI1 fallback, and summary output.

## Testing checklist

Simulator:

- UI2 displays `q`, `o`, `n` and at least one UI1 display.
- No on-screen button hints; controls are documented in the store description.
- `WAITING` on load; lower-button press does nothing.
- First top long press shows `SET` at EX 1 / SET 1 with a count-up timer starting at zero.
- During a set there is no rest countdown; the set timer increases.
- First lower-button press ends set 1, starts rest, and leaves SETS at 1.
- Second lower-button press ends rest, starts the set 2 timer, and advances SETS to 2, even in quick succession.
- Ending set 2 restarts rest and creates its own lap.
- Rest alert plays once at zero.
- REST OVER counts up until the next lower-button press.
- Top long press advances the exercise, starts its set 1 timer, and preserves per-exercise counts.
- Exercise cap at 999.
- Rest length 0 and 600.
- Rest alert disabled.
- Pause and continue during a set and during rest.
- Reloading the app mid-set or mid-rest restores the state.
- End-of-session summary and two logged values; TOTAL tracks SETS from the moment a set starts.
- Each lower press during SET or REST creates a silent lap on UI2.

Real watch:

- Lower button click and slow press both work.
- Top long press feels right and does not interfere with backlight.
- Silent laps appear in the workout without opening a lap view.
- Rest alert vibration/beep.
- Pause, exercise end, summary, and Suunto app sync.

## Known limitations

- Exercise numbers only increase. If you overshoot, continue forward or end the session.
- UI1 watches cannot switch exercises. Their single timer field shows set time during sets and rest time during rest, with no SET/REST label.
- On UI1 watches every lap after the first ends or starts a set, so disable autolap for gym sessions.
- Set duration is not logged; the set timer is for on-screen feedback only.
- Watches without `HAS_SILENT_LAP` do not create automatic laps on lower presses.
- The app does not use GPS, heart rate, or any network connection.
