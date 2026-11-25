var MAX_EXERCISE = 999;
var SESSION_KEY = "sg4";

var exercise = 1;
var counts = [];
var resting = false;
var setStart = 0;
var restStart = 0;
var restTarget = 30;
var restAlert = true;
var alerted = false;
var currentDuration = 0;
var started = false;
var viewState = 3;

var num = function(value, fallback) {
  var n = Number(value);
  return n !== n ? fallback : n;
};

var clamp = function(value, low, high, fallback) {
  var n = num(value, fallback);
  return n < low ? low : (n > high ? high : n);
};

var setDuration = function(input) {
  if (input && input.duration !== undefined) {
    currentDuration = num(input.duration, 0);
  }
};

var readSettings = function() {
  var rawRest = localStorage.getItem("rest_seconds");
  restTarget = Math.floor(clamp(
    rawRest === null || rawRest === undefined || rawRest === "" ? 30 : rawRest,
    0,
    600,
    30
  ));

  var rawAlert = localStorage.getItem("rest_alert");
  if (rawAlert === null || rawAlert === undefined || rawAlert === "") {
    restAlert = true;
  }
  else if (typeof rawAlert === "string") {
    restAlert = rawAlert === "true" || rawAlert === "1";
  }
  else {
    restAlert = !!rawAlert;
  }
};

var getExerciseSets = function() {
  return counts[exercise - 1] || 1;
};

var getTotalSets = function() {
  var total = 0;
  for (var i = 0; i < counts.length; i++) {
    total += counts[i] || 0;
  }
  return total;
};

var getExercisesUsed = function() {
  var used = 0;
  for (var i = 0; i < counts.length; i++) {
    if (counts[i] > 0) {
      used += 1;
    }
  }
  return used;
};

var isRunning = function(input) {
  var state = input && input.exerciseState;
  if (state === undefined || state === null) {
    return true;
  }
  state = Number(state);
  return state !== state || state === 1;
};

var resetSession = function() {
  exercise = 1;
  counts = [];
  resting = false;
  setStart = 0;
  restStart = 0;
  alerted = false;
  started = false;
};

var saveSession = function() {
  try {
    localStorage.setObject(SESSION_KEY, {
      exercise: exercise,
      counts: counts,
      setStart: setStart,
      restStart: restStart,
      resting: resting,
      alerted: alerted,
      started: started
    });
  }
  catch (e) {
  }
};

var loadSession = function() {
  var data = null;

  try {
    if (localStorage.getObject) {
      data = localStorage.getObject(SESSION_KEY);
    }
  }
  catch (e) {
    data = null;
  }

  if (!data || typeof data !== "object") {
    return false;
  }

  exercise = Math.floor(clamp(data.exercise, 1, MAX_EXERCISE, 1));
  setStart = num(data.setStart, 0);
  restStart = num(data.restStart, 0);
  alerted = !!data.alerted;
  started = !!data.started;
  resting = !!data.resting;

  counts = [];
  if (data.counts && typeof data.counts.length === "number") {
    for (var i = 0; i < data.counts.length; i++) {
      var value = Math.floor(num(data.counts[i], 0));
      counts.push(value < 0 ? 0 : value);
    }
  }

  if (!counts[exercise - 1]) {
    counts[exercise - 1] = 1;
  }

  return true;
};

var clearSession = function() {
  try {
    if (localStorage.removeItem) {
      localStorage.removeItem(SESSION_KEY);
    }
  }
  catch (e) {
  }
};

var triggerLap = function() {
  if ('{{ HAS_ON_EVENT }}' != '1' || '{{ HAS_SILENT_LAP }}' != '1') {
    return;
  }
  try {
    $.put('/Activity/Trigger', 23);
  }
  catch (e) {
  }
};

var startSession = function() {
  if (started) {
    return;
  }
  started = true;
  exercise = 1;
  counts[0] = 1;
  resting = false;
  setStart = currentDuration;
  restStart = 0;
  alerted = false;
  saveSession();
};

var startNextSet = function(duration) {
  if (!started) {
    startSession();
    return;
  }
  counts[exercise - 1] = getExerciseSets() + 1;
  resting = false;
  setStart = duration;
  restStart = 0;
  alerted = false;
  saveSession();
  triggerLap();
};

var nextExercise = function() {
  if (!started) {
    startSession();
    return;
  }
  if (exercise < MAX_EXERCISE) {
    exercise += 1;
    counts[exercise - 1] = 1;
    resting = false;
    setStart = currentDuration;
    restStart = 0;
    alerted = false;
    saveSession();
  }
};

var completeSet = function(duration) {
  if (!started) {
    return;
  }
  var now = num(duration, NaN);
  if (now !== now) {
    return;
  }
  resting = true;
  restStart = now;
  alerted = false;
  saveSession();
  triggerLap();
};

var uiViews = [
  'waiting-label', 'waiting-timer', 'session-fields',
  'set-label', 'set-timer',
  'rest-label', 'rest-timer',
  'over-label', 'over-timer'
];
var uiStates = [3, 3, 4, 0, 0, 1, 1, 2, 2];

var applyUiState = function(state) {
  if ('{{ IS_UI2 }}' != '1') {
    return;
  }
  try {
    for (var i = 0; i < uiViews.length; i++) {
      var visible = uiStates[i] === 4 ? state !== 3 : uiStates[i] === state;
      setStyle('#' + uiViews[i], 'visibility', visible ? 'VISIBLE' : 'HIDDEN');
    }
  }
  catch (e) {
  }
};

var computeAndSet = function(duration, output) {
  var state = 3;
  var rest = null;
  var overtime = 0;
  var setElapsed = 0;

  if (started) {
    if (!resting) {
      state = 0;
      setElapsed = Math.floor(duration - setStart);
      if (setElapsed < 0) {
        setElapsed = 0;
      }
      rest = setElapsed;
    }
    else {
      var elapsed = duration - restStart;
      if (elapsed < 0) {
        elapsed = 0;
      }

      if (restTarget > 0 && elapsed < restTarget) {
        state = 1;
        rest = Math.ceil(restTarget - elapsed);
        if (rest < 1) {
          rest = 1;
        }
      }
      else {
        state = 2;
        overtime = Math.floor(elapsed - restTarget);
        if (overtime < 0) {
          overtime = 0;
        }
        rest = overtime;
        if (restAlert && !alerted) {
          try {
            playIndication("Interval");
          }
          catch (e) {
          }
          alerted = true;
          saveSession();
        }
      }
    }
  }

  viewState = state;

  if (output) {
    output.exercise = started ? exercise : 0;
    output.exercise_sets = started ? getExerciseSets() : 0;
    output.total_sets = started ? getTotalSets() : 0;
    output.total_exercises = started ? getExercisesUsed() : 0;
    output.rest = rest;
    output.rest_overtime = overtime;
    output.set_elapsed = setElapsed;
  }

  applyUiState(state);
};

function onLoad(input, output) {
  setDuration(input);
  resetSession();

  if (currentDuration > 0 && loadSession()) {
    if (setStart > currentDuration + 1 || restStart > currentDuration + 1) {
      resetSession();
    }
  }

  // Settings are authoritative for the rest target, even after a restore.
  readSettings();
  computeAndSet(currentDuration, output);
}

function onExerciseStart(input, output) {
  setDuration(input);
  readSettings();
  resetSession();
  clearSession();
  computeAndSet(currentDuration, output);
}

function onExercisePause(input, output) {
}

function onExerciseContinue(input, output) {
}

function onExerciseEnd(input, output) {
  clearSession();
}

function onEvent(input, output, eventId) {
  setDuration(input);

  var id = Number(eventId);

  if (id === 1) {
    if (!started || !isRunning(input)) {
      return;
    }
    if (resting) {
      startNextSet(currentDuration);
    }
    else {
      completeSet(currentDuration);
    }
    computeAndSet(currentDuration, output);
  }
  else if (id === 2) {
    nextExercise();
    computeAndSet(currentDuration, output);
  }
}

function onLap(input, output) {
  if ('{{ HAS_ON_EVENT }}' == '1') {
    return;
  }
  if (!isRunning(input)) {
    return;
  }

  setDuration(input);

  // Lap-only watches have no top-button start action: the first lap
  // starts set 1, then laps alternate between ending a set and starting
  // the next one.
  if (!started) {
    startSession();
  }
  else if (resting) {
    startNextSet(currentDuration);
  }
  else {
    completeSet(currentDuration);
  }

  computeAndSet(currentDuration, output);
}

function evaluate(input, output) {
  setDuration(input);
  computeAndSet(currentDuration, output);
}

function getUserInterface(input, output) {
  if ('{{ IS_UI1 }}' == '1') {
    return {
      template: 't-legacy',
      tl: { input: 'output/exercise', format: 'Count_Fourdigits' },
      tr: { input: 'output/exercise_sets', format: 'Count_Fourdigits' },
      ml: { input: 'output/rest', format: 'Duration_FourdigitsFixed' },
      mr: { input: 'output/total_sets', format: 'Count_Fourdigits' },
      bottom: { input: 'Activity/Move/-1/Duration/Current', format: 'Duration_FourdigitsFixed' }
    };
  }

  return {
    template: 't'
  };
}

function getSummaryOutputs(input, output) {
  var total = getTotalSets();
  if (total <= 0) {
    return [];
  }

  return [
    {
      id: 's',
      name: 'Sets',
      format: 'Count_Fourdigits',
      value: total
    },
    {
      id: 'e',
      name: 'Total Exercises',
      format: 'Count_Threedigits',
      value: getExercisesUsed()
    }
  ];
}
