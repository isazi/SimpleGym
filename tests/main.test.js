var src = readFile('main.js');
var failures = 0;

var store = {};
function resetStore() { store = {}; }
var localStorage = {
  getItem: function(k) { return typeof store[k] === 'string' ? store[k] : null; },
  setItem: function(k, v) { store[k] = String(v); },
  removeItem: function(k) { delete store[k]; },
  setObject: function(k, v) { store[k] = v; },
  getObject: function(k) { return (store[k] && typeof store[k] === 'object') ? store[k] : null; }
};

var laps = 0;
var alerts = 0;
var styleCalls = [];
var textCalls = [];
var stateColors = {
  'css:.c-green': 'green',
  'css:.c-cyan': 'cyan',
  'css:.c-orange': 'orange',
  'css:.c-grey': 'grey'
};
var $ = {
  put: function(path, value) {
    if (path === '/Activity/Trigger') { laps += 1; }
  }
};
function playIndication(name) { alerts += 1; }
function setStyle(id, prop, value) { styleCalls.push([id, prop, value]); }
function getStyle(target) { return stateColors[target] || 'orange'; }
function setText(id, text) { textCalls.push([id, text]); }
function lastText() { return textCalls.length ? textCalls[textCalls.length - 1][1] : null; }
function lastStateColor() {
  for (var i = styleCalls.length - 1; i >= 0; i -= 1) {
    if (styleCalls[i][0] === '#state_text' && styleCalls[i][1] === 'color') {
      return styleCalls[i][2];
    }
  }
  return null;
}
function visibilityCallCount() {
  var count = 0;
  for (var i = 0; i < styleCalls.length; i += 1) {
    if (styleCalls[i][1] === 'visibility') { count += 1; }
  }
  return count;
}

function out() {
  return {
    exercise: 0,
    exercise_sets: 0,
    total_sets: 0,
    total_exercises: 0,
    rest: null,
    rest_overtime: null,
    set_elapsed: null,
    state_code: 3,
    display_timer: 0
  };
}
function assert(cond, msg) {
  if (!cond) { print('FAIL: ' + msg); failures += 1; }
}
function compile(ui1, ui2, event, silent) {
  var code = src
    .split('{{ IS_UI1 }}').join(ui1 ? '1' : '0')
    .split('{{ IS_UI2 }}').join(ui2 ? '1' : '0')
    .split('{{ HAS_ON_EVENT }}').join(event ? '1' : '0')
    .split('{{ HAS_SILENT_LAP }}').join(silent ? '1' : '0');
  var globalEval = eval;
  globalEval(code);
}
function top(o, duration) {
  var t = duration || 0;
  onEvent({ duration: t, activityTimer: t * 1000, exerciseState: 1 }, o, 2);
}
function lower(o, duration) {
  onEvent({ duration: duration, exerciseState: 1 }, o, 1);
}

// --- waiting state -----------------------------------------------------
resetStore();
store.rest_seconds = '90';
store.rest_alert = 'true';
laps = 0; alerts = 0; styleCalls = [];
compile(false, true, true, true);
var o = out();
onLoad({ duration: 0, exerciseState: 0 }, o);
evaluate({ duration: 0, exerciseState: 1 }, o);
assert(viewState === 3, 'waiting state before first top press');
assert(o.state_code === 3 && o.display_timer === 0, 'waiting state and zero timer are output');
assert(lastText() === 'WAIT', 'state text shows WAIT while waiting');
assert(lastStateColor() === 'grey', 'WAIT uses grey');
assert(o.exercise === 0 && o.exercise_sets === 0 && o.total_sets === 0 && o.total_exercises === 0, 'waiting counters are blank');
assert(o.rest === null && o.rest_overtime === 0 && o.set_elapsed === 0, 'waiting has no running timer');
lower(o, 5);
assert(o.total_sets === 0 && laps === 0, 'lower press is ignored while waiting');

// --- first top press starts the set timer ------------------------------
top(o, 10);
assert(o.exercise === 1 && o.exercise_sets === 1 && o.total_sets === 1 && o.total_exercises === 1, 'top press starts at exercise 1 set 1');
assert(viewState === 0 && o.set_elapsed === 0, 'set timer starts at zero');
assert(o.state_code === 0 && o.display_timer === 0, 'UI2 outputs the set state and timer');
assert(lastText() === 'SET', 'state text switches to SET on first top press');
assert(lastStateColor() === 'green', 'SET uses green');
var visibilityCallsBeforeEvaluate = visibilityCallCount();
evaluate({ duration: 15, exerciseState: 1 }, o);
assert(visibilityCallCount() === visibilityCallsBeforeEvaluate, 'UI2 does not use visibility scripting');
assert(viewState === 0 && o.set_elapsed === 5, 'set timer counts up open ended');
assert(o.state_code === 0 && o.display_timer === 5, 'set timer output counts up');
assert(o.rest === 5 && o.rest_overtime === 0 && viewState === 0, 'rest view is hidden during a set');
assert(getSummaryOutputs({ duration: 15 }, o).length === 2, 'started set appears in the summary');

onExercisePause({}, o);
var exerciseWhilePaused = o.exercise;
var setsWhilePaused = o.exercise_sets;
var totalWhilePaused = o.total_sets;
laps = 0;
lower(o, 16);
assert(o.exercise_sets === setsWhilePaused && o.total_sets === totalWhilePaused, 'paused lower press does not change SETS or TOTAL');
assert(viewState === 0 && laps === 0, 'paused lower press does not start rest or create a lap');
top(o, 16);
assert(o.exercise === exerciseWhilePaused && o.total_sets === totalWhilePaused, 'paused top long press does not advance exercise');
assert(viewState === 0 && laps === 0, 'paused top long press does not change state or create a lap');
onExerciseContinue({}, o);

// --- first lower press ends the set and starts rest --------------------
lower(o, 20);
assert(o.total_sets === 1 && o.exercise_sets === 1, 'ending set 1 keeps SETS at 1 during rest');
assert(viewState === 1 && o.rest === 90, 'rest starts after set 1');
assert(o.state_code === 1 && o.display_timer === 90, 'rest countdown output starts at target');
assert(lastText() === 'REST', 'state text switches to REST on set end');
assert(lastStateColor() === 'cyan', 'REST uses cyan');
assert(o.set_elapsed === 0, 'set timer stops during rest');
assert(laps === 1, 'one lap per completed set');

evaluate({ duration: 50, exerciseState: 1 }, o);
assert(viewState === 1 && o.rest === 60, 'rest counts down');
assert(o.state_code === 1 && o.display_timer === 60, 'rest countdown output counts down');

evaluate({ duration: 110, exerciseState: 1 }, o);
assert(viewState === 2 && o.rest === 0 && o.rest_overtime === 0, 'rest over at target');
assert(o.state_code === 2 && o.display_timer === 0, 'rest over output appears at zero');
assert(lastText() === 'OVER', 'state text switches to OVER after rest ends');
assert(lastStateColor() === 'orange', 'OVER uses orange');
assert(alerts === 1, 'alert fired once at rest end');

evaluate({ duration: 115, exerciseState: 1 }, o);
assert(viewState === 2 && o.rest_overtime === 5 && o.rest === 5, 'overtime counts up');
assert(o.display_timer === 5, 'overtime output counts up');
assert(alerts === 1, 'alert does not repeat');

// --- second lower press starts set 2 -----------------------------------
lower(o, 120);
assert(o.exercise_sets === 2 && o.total_sets === 2, 'second press starts set 2 and TOTAL follows immediately');
assert(viewState === 0 && o.set_elapsed === 0 && o.rest === 0, 'set 2 has an open-ended timer, no rest timer');
assert(o.state_code === 0 && o.display_timer === 0, 'set 2 output resets');
assert(lastText() === 'SET', 'state text switches back to SET on next set');
assert(lastStateColor() === 'green', 'next SET returns to green');
assert(laps === 2, 'starting the next set also creates a lap');

evaluate({ duration: 126, exerciseState: 1 }, o);
assert(viewState === 0 && o.set_elapsed === 6, 'set 2 timer counts up');

lower(o, 130);
assert(o.total_sets === 2 && o.exercise_sets === 2 && viewState === 1 && o.rest === 90, 'ending set 2 restarts rest');
assert(laps === 3, 'second completed set creates its own lap');

// --- exercise switching ------------------------------------------------
top(o, 140);
assert(o.exercise === 2 && o.exercise_sets === 1 && o.total_sets === 3 && o.total_exercises === 2, 'exercise switch starts the new exercise at set 1');
assert(viewState === 0 && o.set_elapsed === 0, 'new exercise has a fresh set timer');

lower(o, 150);
assert(o.exercise === 2 && o.exercise_sets === 1 && o.total_sets === 3, 'ending set 1 of new exercise does not change TOTAL');
assert(laps === 4, 'laps keep accumulating across exercises');

var summary = getSummaryOutputs({ duration: 160 }, o);
assert(summary.length === 2, 'summary has two fields');
assert(summary[0].name === 'Sets' && summary[0].value === 3, 'summary total sets');
assert(summary[1].name === 'Total Exercises' && summary[1].value === 2, 'summary exercises used');

// --- restore during rest -----------------------------------------------
var o2 = out();
onLoad({ duration: 180, exerciseState: 1 }, o2);
assert(o2.exercise === 2, 'restore exercise');
assert(o2.total_sets === 3, 'restore total sets');
assert(o2.exercise_sets === 1, 'restore set number');
assert(viewState === 1 && o2.rest === 60, 'restore rest countdown');

// --- restore during a set ----------------------------------------------
resetStore();
store.rest_seconds = '90';
store.rest_alert = 'true';
compile(false, true, true, true);
o = out();
onLoad({ duration: 0, exerciseState: 0 }, o);
top(o, 10);
var activeRestore = out();
onLoad({ duration: 30, exerciseState: 1 }, activeRestore);
assert(viewState === 0 && activeRestore.exercise_sets === 1, 'active set restores');
assert(activeRestore.total_sets === 1 && activeRestore.set_elapsed === 20, 'active set timer restores');

// --- rapid consecutive presses are accepted ----------------------------
resetStore();
store.rest_seconds = '90';
store.rest_alert = 'true';
laps = 0; alerts = 0;
compile(false, true, true, true);
o = out();
onLoad({ duration: 0, exerciseState: 0 }, o);
top(o, 0);
lower(o, 1);
lower(o, 1.5);
assert(o.exercise_sets === 2 && o.total_sets === 2, 'rapid second press starts set 2');
assert(viewState === 0 && o.set_elapsed === 0, 'rapid second press clears rest');
assert(laps === 2, 'rapid second press also creates a lap');

// --- switching away from an active set does not count it ---------------
resetStore();
store.rest_seconds = '90';
store.rest_alert = 'true';
compile(false, true, true, true);
o = out();
onLoad({ duration: 0, exerciseState: 0 }, o);
top(o, 0);
top(o, 1);
assert(o.exercise === 2 && o.exercise_sets === 1 && o.total_sets === 2, 'switching exercises counts both started sets');

// --- rest length 0 -----------------------------------------------------
resetStore();
store.rest_seconds = '0';
store.rest_alert = 'true';
laps = 0; alerts = 0;
compile(false, true, true, true);
o = out();
onLoad({ duration: 0, exerciseState: 0 }, o);
top(o, 0);
lower(o, 10);
assert(viewState === 2 && o.rest_overtime === 0, 'zero rest goes straight to over');

// --- alert off ---------------------------------------------------------
resetStore();
store.rest_seconds = '90';
store.rest_alert = 'false';
laps = 0; alerts = 0;
compile(false, true, true, true);
o = out();
onLoad({ duration: 0, exerciseState: 0 }, o);
top(o, 0);
lower(o, 10);
evaluate({ duration: 110, exerciseState: 1 }, o);
assert(viewState === 2 && alerts === 0, 'alert can be disabled');

// --- zero rest target restores as zero ---------------------------------
resetStore();
store.rest_seconds = '0';
store.rest_alert = 'true';
compile(false, true, true, true);
o = out();
onLoad({ duration: 0, exerciseState: 0 }, o);
top(o, 0);
lower(o, 10);
var restored = out();
onLoad({ duration: 20, exerciseState: 1 }, restored);
assert(viewState === 2, 'zero rest target restored as zero');

// --- exercise clamp ----------------------------------------------------
for (var i = 0; i < 1200; i++) { nextExercise(); }
assert(exercise === 999 && getExerciseSets() === 1, 'exercise counter clamps at 999 and resets set 1');

// --- UI1 / lap path ----------------------------------------------------
resetStore();
store.rest_seconds = '90';
store.rest_alert = 'true';
laps = 0; alerts = 0; styleCalls = []; textCalls = [];
compile(true, false, false, false);
o = out();
onLoad({ duration: 0, exerciseState: 0 }, o);
onExerciseStart({ duration: 0 }, o);
var ui = getUserInterface({}, o);
assert(ui.template === 't-legacy', 'UI1 uses legacy template');
assert(ui.tl.input === 'output/exercise', 'UI1 fields defined');
onLap({ duration: 10, exerciseState: 1 }, o);
assert(o.exercise_sets === 1 && o.total_sets === 1 && viewState === 0, 'first UI1 lap starts set 1');
onExercisePause({}, o);
var ui1SetsPaused = o.exercise_sets;
var ui1TotalPaused = o.total_sets;
onLap({ duration: 12, exerciseState: 1 }, o);
assert(o.exercise_sets === ui1SetsPaused && o.total_sets === ui1TotalPaused && viewState === 0, 'UI1 lap is ignored while paused');
onExerciseContinue({}, o);
evaluate({ duration: 15, exerciseState: 1 }, o);
assert(o.set_elapsed === 5, 'UI1 set timer counts up');
onLap({ duration: 20, exerciseState: 1 }, o);
assert(o.total_sets === 1 && o.exercise_sets === 1 && viewState === 1 && o.rest === 90, 'second UI1 lap ends set 1 and starts rest');
onLap({ duration: 30, exerciseState: 1 }, o);
assert(o.total_sets === 2 && o.exercise_sets === 2 && viewState === 0, 'third UI1 lap starts set 2');
assert(laps === 0, 'UI1 does not trigger an extra lap');
assert(styleCalls.length === 0, 'UI1 never calls setStyle');
assert(textCalls.length === 0, 'UI1 never calls setText');

// --- UI2 without onEvent falls back to lap -----------------------------
resetStore();
store.rest_seconds = '90';
store.rest_alert = 'true';
laps = 0; alerts = 0; styleCalls = [];
compile(false, true, false, false);
o = out();
onLoad({ duration: 0, exerciseState: 0 }, o);
onExerciseStart({ duration: 0 }, o);
onLap({ duration: 10, exerciseState: 1 }, o);
onLap({ duration: 20, exerciseState: 1 }, o);
onLap({ duration: 30, exerciseState: 1 }, o);
assert(o.total_sets === 2 && o.exercise_sets === 2 && viewState === 0, 'UI2 lap fallback alternates set and rest');
assert(laps === 0, 'UI2 lap fallback does not trigger an extra lap');
assert(o.state_code === 0, 'UI2 lap fallback updates the state code');

// --- non-object / missing storage --------------------------------------
resetStore();
compile(false, true, true, true);
o = out();
onLoad({ duration: 0, exerciseState: 0 }, o);
assert(o.rest === null && o.total_sets === 0 && viewState === 3, 'clean load stays in waiting state');

// --- idle / prestart / paused press is ignored -------------------------
resetStore();
compile(false, true, true, true);
laps = 0; alerts = 0;
o = out();
onLoad({ duration: 0, exerciseState: 0 }, o);
onEvent({ duration: 5, exerciseState: 0 }, o, 1);
assert(o.total_sets === 0, 'press while idle is ignored');
onEvent({ duration: 5, exerciseState: 3 }, o, 1);
assert(o.total_sets === 0, 'press while prestart is ignored');
onEvent({ duration: 5, exerciseState: 2 }, o, 1);
assert(o.total_sets === 0, 'press while paused is ignored');
onEvent({ duration: 5, exerciseState: 4 }, o, 1);
assert(o.total_sets === 0, 'press while state is invalid is ignored');
top(o, 5);
lower(o, 6);
assert(o.total_sets === 1, 'press while running is accepted after start');

// --- empty summary -----------------------------------------------------
resetStore();
compile(false, true, true, true);
o = out();
onLoad({ duration: 0, exerciseState: 0 }, o);
onExerciseStart({ duration: 0 }, o);
assert(getSummaryOutputs({ duration: 10 }, o).length === 0, 'no summary while waiting');
top(o, 0);
assert(getSummaryOutputs({ duration: 10 }, o).length === 2, 'active set appears in the summary');
lower(o, 10);
onExerciseEnd({ duration: 20 }, o);
var afterEnd = out();
onLoad({ duration: 30, exerciseState: 1 }, afterEnd);
assert(afterEnd.total_sets === 0 && viewState === 3, 'session cleared at exercise end');

// --- object storage path -----------------------------------------------
resetStore();
store.rest_seconds = '45';
store.rest_alert = 'true';
compile(false, true, true, true);
o = out();
onLoad({ duration: 0, exerciseState: 0 }, o);
onExerciseStart({ duration: 0 }, o);
top(o, 0);
lower(o, 10);
assert(store.sg4 && typeof store.sg4 === 'object', 'session stored as object');
assert(store.sg4.currentSet === undefined && store.sg4.totalSets === undefined, 'derived values are not stored');
var objectRestore = out();
onLoad({ duration: 15, exerciseState: 1 }, objectRestore);
assert(objectRestore.total_sets === 1 && objectRestore.rest === 40, 'object session restored');

// --- stale session is discarded ----------------------------------------
resetStore();
store.rest_seconds = '90';
store.rest_alert = 'true';
compile(false, true, true, true);
o = out();
onLoad({ duration: 0, exerciseState: 0 }, o);
onExerciseStart({ duration: 0 }, o);
top(o, 0);
lower(o, 5000);
var stale = out();
onLoad({ duration: 20, exerciseState: 1 }, stale);
assert(stale.total_sets === 0 && viewState === 3, 'stale session from future duration is discarded');

// --- object storage failures are swallowed ------------------------------
resetStore();
store.rest_seconds = '30';
store.rest_alert = 'true';
compile(false, true, true, true);
o = out();
onLoad({ duration: 0, exerciseState: 0 }, o);
onExerciseStart({ duration: 0 }, o);
localStorage.setObject = function() { throw new Error('setObject unavailable'); };
top(o, 0);
lower(o, 10);
assert(viewState === 1 && o.rest === 30, 'storage failure does not break the set flow');
var noRestore = out();
onLoad({ duration: 20, exerciseState: 1 }, noRestore);
assert(noRestore.total_sets === 0 && viewState === 3, 'failed save leaves nothing to restore');
localStorage.setObject = function(k, v) { store[k] = v; };

// --- duplicate long-press callbacks are collapsed -----------------------
resetStore();
store.rest_seconds = '30';
store.rest_alert = 'true';
compile(false, true, true, true);
o = out();
onLoad({ duration: 0, exerciseState: 0 }, o);
onEvent({ duration: 10, activityTimer: 10000, exerciseState: 1 }, o, 2);
onEvent({ duration: 10, activityTimer: 10400, exerciseState: 1 }, o, 2);
assert(o.exercise === 1 && o.total_sets === 1, 'long press start and full events count once');
onEvent({ duration: 12, activityTimer: 12000, exerciseState: 1 }, o, 2);
assert(o.exercise === 2 && o.total_sets === 2, 'a later long press still advances the exercise');

if (failures === 0) {
  print('ALL TESTS PASSED');
} else {
  print('FAILURES: ' + failures);
}
