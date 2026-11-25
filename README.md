# Simple Gym

A SuuntoPlus watch app for logging gym sets and tracking rest without leaving the workout screen.

Simple Gym is deliberately minimal: no exercise names, no weight or rep entry, no menus. Press the lower button when you finish a set, and the watch counts it and starts your rest timer. When rest is done, the watch beeps/vibrates once and then counts up as **REST OVER** until your next set.

## Controls

| Action | UI2 watches | UI1 / lap-only watches |
| --- | --- | --- |
| Lower button press | Logs one set, starts/restarts rest, creates a lap | Normal lap logs one set |
| Lower button long press | Also logs one set, for slow presses | — |
| Top button long press | Advances to the next exercise number | — |
| Top button click | Backlight, unchanged | — |
| Middle button | Pause/menu, unchanged | — |

The exercise number starts at 1 and only moves forward. There is no upper limit in normal use; the value is capped at 999 for display safety. Sets are counted separately for every exercise number.

There is no start-set/end-set flow. Every accepted press records one completed set. Presses less than two seconds after the previous set are ignored so one physical press is never counted twice. Presses while the workout is idle, in pre-start, or paused are ignored.

Button events are handled by the Simple Gym screen itself. Keep that screen visible while you train; on other watch screens the lower button keeps its normal behaviour.

## Rest timer

- Rest length is configured in the Suunto app, not on the watch: **Rest length [s]**, from 0 to 600 seconds, default 90.
- Logging a set restarts the countdown from the configured length.
- The countdown is based on activity duration, so pausing the workout freezes it automatically.
- At zero the watch plays the `Interval` indication once (sound and/or vibration, depending on watch settings).
- After zero the display switches to **REST OVER** and counts up, so you can see how much rest you have taken.
- **Rest alert** can be disabled in the Suunto app. No repeat alerts are played.

## Display

UI2 watches (`n`, `o`, `q` displays):

- Current exercise number and sets for that exercise at the top.
- Large rest countdown in the center: `READY`, `REST`, or `REST OVER` with overtime.
- Total sets and session duration at the bottom.
- Button hints: `LOWER = LOG SET`, `HOLD TOP = NEXT EX`.
- On watches without `onEvent` support the hints change to `LAP = LOG SET`.

UI1 watches use a minimal four-field layout: exercise, current-exercise sets, rest, total sets, plus the session duration. Exercise switching is not available on UI1. The normal lap button logs a set on UI1.

## Laps and workout data

Each logged set creates one lap on UI2 watches with silent-lap support (`/Activity/Trigger` value 23), so the workout timeline has one lap per set without opening a lap view. On UI1 the system lap that triggered `onLap` is the lap; no extra lap is created.

Because a lap is created when a set is completed, the lap time is the interval since the previous set, including the preceding rest. Disable autolap if you want the workout to contain exactly one lap per set.

If the watch does not support silent laps (`HAS_SILENT_LAP` is 0), Simple Gym does not trigger a lap automatically. This avoids interrupting the set flow with a lap view. The set and rest tracking still work.

Four values are written to the workout log:

- `Exercise`
- `Exercise sets`
- `Total sets`
- `Rest remaining`

## End-of-session summary

After the workout, the Suunto app shows:

- **Sets** — total sets logged
- **Exercises** — number of exercise numbers with at least one set
- **Session time** — total workout duration

No summary is produced if no set was logged.

## Settings

| Setting | Type | Default | Notes |
| --- | --- | --- | --- |
| Rest length [s] | integer slider | 90 | 0–600 seconds; 0 goes straight to **REST OVER** after a set |
| Rest alert | boolean | on | Play the `Interval` indication when rest reaches zero |

Settings are read when the workout starts and when the app screen is loaded. They are stored by the SuuntoPlus runtime in `data.json` / local storage.

## Session restore

The session state is saved after every set and exercise change, and when the rest alert fires. If the watch reloads the app screen during a workout, the exercise, per-exercise counts, rest target, and countdown are restored. The saved session is cleared when the workout ends.

## Files

```
SimpleGym/
├── manifest.json      # app metadata, inputs, outputs, settings, templates
├── main.js            # state machine, rest timer, lap triggering, summary
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
    ├── screen-ready.png    # 466x466 ready screen
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

This requires macOS JavaScriptCore (`jsc`), which ships with macOS and Xcode. The tests substitute the compile-time tokens, run all lifecycle callbacks, and check set logging, laps, rest timing, alerts, restore, UI1 fallback, and summary output.

## Testing checklist

Simulator:

- UI2 displays `q`, `o`, `n` and at least one UI1 display.
- `READY` before the first set.
- First set starts the rest countdown.
- Second set resets the countdown and increments the set counters.
- Rest alert plays once at zero.
- Overtime counts up and resets after the next set.
- Top long press advances the exercise and preserves per-exercise counts.
- Exercise cap at 999.
- Rest length 0 and 600.
- Rest alert disabled.
- Pause and continue during rest.
- Reloading the app mid-session restores the state.
- End-of-session summary and four logged values.
- Number of laps equals the number of accepted sets on UI2.

Real watch:

- Lower button click and slow press both log a set.
- Top long press feels right and does not interfere with backlight.
- Silent laps appear in the workout without opening a lap view.
- Rest alert vibration/beep.
- Pause, exercise end, summary, and Suunto app sync.

## Known limitations

- Exercise numbers only increase. If you overshoot, continue forward or end the session.
- UI1 watches cannot switch exercises. The single rest field counts down during rest and then counts up during overtime, but there is no `REST OVER` label.
- On UI1 watches every lap is treated as a set, so disable autolap for gym sessions.
- Set duration is not measured; a set is recorded as a completed event when you press the button.
- Watches without `HAS_SILENT_LAP` do not create automatic laps per set.
- The app does not use GPS, heart rate, or any network connection.
