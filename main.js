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
var paused = false;
var viewState = 3;
var TOP_EVENT_GAP_MS = 950;
var lastTopEventMs = null;
var lastTopEventDuration = null;
var STATE_LABELS = ["SET", "REST", "OVER", "WAIT"];
var STATE_COLORS = ["css:.c-green", "css:.c-cyan", "css:.c-orange", "css:.c-grey"];

var num = function(value, fallback) {
  var n = Number(value);
  return n !== n ? fallback : n;
};

var clamp = function(value, low, high, fallback) {
  var n = num(value, fallback);
  return n < low ? low : (n > high ? high : n);
};

var updateStateText = function(state) {
  if ('{{ IS_UI2 }}' != '1') {
    return;
  }
  if (typeof setText === "function") {
    setText("#state_text", STATE_LABELS[state] || "WAIT");
  }
  if (typeof setStyle === "function" && typeof getStyle === "function") {
    setStyle(
      "#state_text",
      "color",
      getStyle(STATE_COLORS[state] || "css:.c-grey", "color", true)
    );
  }
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

var isDuplicateTopEvent = function(input) {
  var now = input && input.activityTimer !== undefined ? Number(input.activityTimer) : NaN;
  if (now === now) {
    if (lastTopEventMs !== null && now >= lastTopEventMs && now - lastTopEventMs < TOP_EVENT_GAP_MS) {
      return true;
    }
    lastTopEventMs = now;
    return false;
  }

  if (lastTopEventDuration !== null && currentDuration >= lastTopEventDuration &&
      currentDuration - lastTopEventDuration < 2) {
    return true;
  }
  lastTopEventDuration = currentDuration;
  return false;
};

var resetSession = function() {
  exercise = 1;
  counts = [];
  resting = false;
  setStart = 0;
  restStart = 0;
  alerted = false;
  started = false;
  lastTopEventMs = null;
  lastTopEventDuration = null;
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

var beginSet = function(duration) {
  resting = false;
  setStart = duration;
  restStart = 0;
  alerted = false;
  saveSession();
};

var startSession = function() {
  if (started) {
    return;
  }
  started = true;
  exercise = 1;
  counts[0] = 1;
  beginSet(currentDuration);
};

var startNextSet = function(duration) {
  if (!started) {
    startSession();
    return;
  }
  counts[exercise - 1] = getExerciseSets() + 1;
  beginSet(duration);
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
    beginSet(currentDuration);
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

// Lower presses and the lap-only fallback follow the same sequence:
// start, end a set, or start the next set.
var handleLowerPress = function(duration, output) {
  if (!started) {
    startSession();
  }
  else if (resting) {
    startNextSet(duration);
  }
  else {
    completeSet(duration);
  }
  computeAndSet(currentDuration, output);
};

var computeAndSet = function(duration, output) {
  var state = 3;
  var rest = null;
  var overtime = 0;
  var setElapsed = 0;
  var displayTimer = 0;

  if (started) {
    if (!resting) {
      state = 0;
      setElapsed = Math.floor(duration - setStart);
      if (setElapsed < 0) {
        setElapsed = 0;
      }
      rest = setElapsed;
      displayTimer = setElapsed;
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
        displayTimer = rest;
      }
      else {
        state = 2;
        overtime = Math.floor(elapsed - restTarget);
        if (overtime < 0) {
          overtime = 0;
        }
        rest = overtime;
        displayTimer = overtime;
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
  updateStateText(state);

  if (output) {
    output.exercise = started ? exercise : 0;
    output.exercise_sets = started ? getExerciseSets() : 0;
    output.total_sets = started ? getTotalSets() : 0;
    output.total_exercises = started ? getExercisesUsed() : 0;
    output.rest = rest;
    output.rest_overtime = overtime;
    output.set_elapsed = setElapsed;
    output.state_code = state;
    output.display_timer = displayTimer;
  }
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
  paused = false;
  clearSession();
  computeAndSet(currentDuration, output);
}

function onExercisePause(input, output) {
  paused = true;
}

function onExerciseContinue(input, output) {
  paused = false;
}

function onExerciseEnd(input, output) {
  clearSession();
}

function onEvent(input, output, eventId) {
  setDuration(input);

  var id = Number(eventId);
  if (id === 1) {
    if (paused || !started) {
      return;
    }
    handleLowerPress(currentDuration, output);
  }
  else if (id === 2) {
    if (paused || isDuplicateTopEvent(input)) {
      return;
    }
    nextExercise();
    computeAndSet(currentDuration, output);
  }
}

function onLap(input, output) {
  if ('{{ HAS_ON_EVENT }}' == '1') {
    return;
  }
  if (paused || !isRunning(input)) {
    return;
  }

  setDuration(input);
  handleLowerPress(currentDuration, output);
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
