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
var $ = {
  put: function(path, value) {
    if (path === '/Activity/Trigger') { laps += 1; }
  }
};
function playIndication(name) { alerts += 1; }
function setStyle(id, prop, value) { styleCalls.push([id, prop, value]); }

function out() {
  return { exercise: 0, exercise_sets: 0, total_sets: 0, rest: null, rest_overtime: null, state: 0 };
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

// --- UI2 path ---------------------------------------------------------
resetStore();
store.rest_seconds = '90';
store.rest_alert = 'true';
compile(false, true, true, true);

var o = out();
onLoad({ duration: 0, exerciseState: 0 }, o);
evaluate({ duration: 0, exerciseState: 1 }, o);
assert(o.state === 0 && o.rest === 0 && o.rest_display === null, 'ready state before first set');
assert(o.total_sets === 0 && o.exercise === 1, 'ready counters');

onEvent({ duration: 10, exerciseState: 1 }, o, 1);
assert(o.total_sets === 1, 'first set counted');
assert(o.exercise_sets === 1, 'first set counted for exercise');
assert(laps === 1, 'one lap per set');
assert(o.state === 1 && o.rest === 90 && o.rest_display === 90, 'rest starts after set');

evaluate({ duration: 50, exerciseState: 1 }, o);
assert(o.state === 1 && o.rest === 50, 'rest counts down');

evaluate({ duration: 100, exerciseState: 1 }, o);
assert(o.state === 2 && o.rest === 0 && o.rest_overtime === 0, 'rest over at target');
assert(alerts === 1, 'alert fired once at rest end');

evaluate({ duration: 105, exerciseState: 1 }, o);
assert(o.state === 2 && o.rest_overtime === 5, 'overtime counts up');
assert(o.rest_display === 5, 'UI1 rest field shows overtime count-up');
assert(alerts === 1, 'alert does not repeat');

onEvent({ duration: 110, exerciseState: 1 }, o, 1);
assert(o.total_sets === 2 && o.rest === 90 && o.state === 1, 'second set resets rest');

onEvent({ duration: 110.5, exerciseState: 1 }, o, 1);
assert(o.total_sets === 2, 'debounce ignores double press');

onEvent({ duration: 120, exerciseState: 1 }, o, 2);
assert(o.exercise === 2 && o.exercise_sets === 0 && o.total_sets === 2, 'exercise increments');

onEvent({ duration: 130, exerciseState: 1 }, o, 1);
assert(o.exercise === 2 && o.exercise_sets === 1 && o.total_sets === 3, 'sets tracked per exercise');
assert(laps === 3, 'lap per set across exercises');

var summary = getSummaryOutputs({ duration: 140 }, o);
assert(summary.length === 3, 'summary has three fields');
assert(summary[0].value === 3, 'summary total sets');
assert(summary[1].value === 2, 'summary exercises used');
assert(summary[2].value === 140, 'summary duration');

// --- restore ----------------------------------------------------------
var o2 = out();
onLoad({ duration: 150, exerciseState: 1 }, o2);
assert(o2.exercise === 2, 'restore exercise');
assert(o2.total_sets === 3, 'restore total sets');
assert(o2.exercise_sets === 1, 'restore exercise sets');
assert(o2.state === 1 && o2.rest === 70, 'restore rest countdown');

// --- rest length 0 ----------------------------------------------------
resetStore();
store.rest_seconds = '0';
store.rest_alert = 'true';
laps = 0; alerts = 0;
compile(false, true, true, true);
o = out();
onLoad({ duration: 0, exerciseState: 0 }, o);
onExerciseStart({ duration: 0 }, o);
onEvent({ duration: 10, exerciseState: 1 }, o, 1);
assert(o.state === 2 && o.rest_overtime === 0, 'zero rest goes straight to over');

// --- alert off --------------------------------------------------------
resetStore();
store.rest_seconds = '90';
store.rest_alert = 'false';
laps = 0; alerts = 0;
compile(false, true, true, true);
o = out();
onLoad({ duration: 0, exerciseState: 0 }, o);
onExerciseStart({ duration: 0 }, o);
onEvent({ duration: 10, exerciseState: 1 }, o, 1);
evaluate({ duration: 100, exerciseState: 1 }, o);
assert(o.state === 2 && alerts === 0, 'alert can be disabled');

// --- zero rest target restores as zero --------------------------------
resetStore();
store.rest_seconds = '0';
store.rest_alert = 'true';
compile(false, true, true, true);
o = out();
onLoad({ duration: 0, exerciseState: 0 }, o);
onExerciseStart({ duration: 0 }, o);
onEvent({ duration: 10, exerciseState: 1 }, o, 1);
var restored = out();
onLoad({ duration: 20, exerciseState: 1 }, restored);
assert(restored.state === 2, 'zero rest target restored as zero');

// --- exercise clamp ---------------------------------------------------
for (var i = 0; i < 1200; i++) { nextExercise(); }
assert(exercise === 999, 'exercise counter clamps at 999');

// --- UI1 / lap path ---------------------------------------------------
resetStore();
store.rest_seconds = '90';
store.rest_alert = 'true';
laps = 0; alerts = 0; styleCalls = [];
compile(true, false, false, false);
o = out();
onLoad({ duration: 0, exerciseState: 0 }, o);
onExerciseStart({ duration: 0 }, o);
var ui = getUserInterface({}, o);
assert(ui.template === 't-legacy', 'UI1 uses legacy template');
assert(ui.tl.input === 'output/exercise', 'UI1 fields defined');
onLap({ duration: 10, exerciseState: 1 }, o);
evaluate({ duration: 50, exerciseState: 1 }, o);
assert(o.total_sets === 1 && o.state === 1 && o.rest === 50, 'UI1 lap logs a set and starts rest');
assert(laps === 0, 'UI1 does not trigger an extra lap');
assert(styleCalls.length === 0, 'UI1 never calls setStyle');

// --- UI2 without onEvent falls back to lap ---------------------------
resetStore();
store.rest_seconds = '90';
store.rest_alert = 'true';
laps = 0; alerts = 0; styleCalls = [];
compile(false, true, false, false);
o = out();
onLoad({ duration: 0, exerciseState: 0 }, o);
onExerciseStart({ duration: 0 }, o);
onLap({ duration: 10, exerciseState: 1 }, o);
evaluate({ duration: 50, exerciseState: 1 }, o);
assert(o.total_sets === 1 && o.state === 1, 'UI2 lap fallback logs a set');
assert(laps === 0, 'UI2 lap fallback does not trigger an extra lap');
assert(styleCalls.length > 0, 'UI2 lap fallback still updates the view state');

// --- non-object / missing storage ------------------------------------
resetStore();
compile(false, true, true, true);
o = out();
onLoad({ duration: 0, exerciseState: 0 }, o);
assert(o.rest === 0 && o.rest_display === null && o.total_sets === 0, 'clean load without stored session');


// --- exercise switch before any set -----------------------------------
resetStore();
store.rest_seconds = '60';
store.rest_alert = 'true';
styleCalls = []; laps = 0; alerts = 0;
compile(false, true, true, true);
o = out();
onLoad({ duration: 0, exerciseState: 0 }, o);
onEvent({ duration: 0, exerciseState: 1 }, o, 2);
assert(o.exercise === 2 && o.total_sets === 0, 'exercise can change before first set');

// --- idle / prestart / paused press is ignored ------------------------
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
onEvent({ duration: 5, exerciseState: 1 }, o, 1);
assert(o.total_sets === 1, 'press while running is accepted');

// --- empty summary ----------------------------------------------------
resetStore();
compile(false, true, true, true);
o = out();
onLoad({ duration: 0, exerciseState: 0 }, o);
onExerciseStart({ duration: 0 }, o);
assert(getSummaryOutputs({ duration: 10 }, o).length === 0, 'no summary without sets');

// --- end of exercise clears the session -------------------------------
onEvent({ duration: 10, exerciseState: 1 }, o, 1);
assert(o.total_sets === 1, 'set before end');
onExerciseEnd({ duration: 20 }, o);
var afterEnd = out();
onLoad({ duration: 30, exerciseState: 1 }, afterEnd);
assert(afterEnd.total_sets === 0, 'session cleared at exercise end');

// --- object storage path ---------------------------------------------
resetStore();
store.rest_seconds = '45';
store.rest_alert = 'true';
compile(false, true, true, true);
o = out();
onLoad({ duration: 0, exerciseState: 0 }, o);
onExerciseStart({ duration: 0 }, o);
onEvent({ duration: 10, exerciseState: 1 }, o, 1);
assert(store.simplegym_session_v1 && typeof store.simplegym_session_v1 === 'object', 'session stored as object');
var objectRestore = out();
onLoad({ duration: 15, exerciseState: 1 }, objectRestore);
assert(objectRestore.total_sets === 1 && objectRestore.rest === 40, 'object session restored');



// --- stale session is discarded ---------------------------------------
resetStore();
store.rest_seconds = '90';
store.rest_alert = 'true';
compile(false, true, true, true);
o = out();
onLoad({ duration: 0, exerciseState: 0 }, o);
onExerciseStart({ duration: 0 }, o);
onEvent({ duration: 5000, exerciseState: 1 }, o, 1);
var stale = out();
onLoad({ duration: 20, exerciseState: 1 }, stale);
assert(stale.total_sets === 0 && stale.state === 0, 'stale session from future duration is discarded');



// --- string storage fallback -----------------------------------------
resetStore();
store.rest_seconds = '30';
store.rest_alert = 'true';
compile(false, true, true, true);
o = out();
onLoad({ duration: 0, exerciseState: 0 }, o);
onExerciseStart({ duration: 0 }, o);
localStorage.setObject = function() { throw new Error('setObject unavailable'); };
onEvent({ duration: 10, exerciseState: 1 }, o, 1);
assert(typeof store.simplegym_session_v1 === 'string', 'falls back to string storage when setObject fails');
var stringRestore = out();
onLoad({ duration: 20, exerciseState: 1 }, stringRestore);
assert(stringRestore.total_sets === 1 && stringRestore.rest === 20, 'string session restored');


if (failures === 0) {
  print('ALL TESTS PASSED');
} else {
  print('FAILURES: ' + failures);
}
