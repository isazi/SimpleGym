var MAX_EXERCISE = 999;
var MIN_SET_GAP = 2;
var SESSION_KEY = "simplegym_session_v1";

var exercise = 1;
var counts = [];
var totalSets = 0;
var lastSetAt = -9999;
var restStart = 0;
var restTarget = 90;
var restAlert = true;
var alerted = false;
var currentDuration = 0;

var clampNumber = function(value, low, high, fallback) {
  var n = Number(value);
  if (n !== n) {
    n = fallback;
  }
  if (n < low) {
    n = low;
  }
  if (n > high) {
    n = high;
  }
  return n;
};

var readSettings = function() {
  var rawRest = localStorage.getItem("rest_seconds");
  var rest = 90;
  if (rawRest !== null && rawRest !== undefined && rawRest !== "") {
    rest = Number(rawRest);
    if (rest !== rest) {
      rest = 90;
    }
  }
  restTarget = Math.floor(clampNumber(rest, 0, 600, 90));

  restAlert = true;
  var rawAlert = localStorage.getItem("rest_alert");
  if (rawAlert !== null && rawAlert !== undefined && rawAlert !== "") {
    if (typeof rawAlert === "string") {
      restAlert = (rawAlert === "true" || rawAlert === "1");
    }
    else {
      restAlert = rawAlert ? true : false;
    }
  }
};

var getExerciseSets = function() {
  var value = Number(counts[exercise - 1]);
  if (value !== value || value < 0) {
    return 0;
  }
  return value;
};

var isRunning = function(input) {
  if (!input || input.exerciseState === undefined || input.exerciseState === null) {
    return true;
  }
  var state = Number(input.exerciseState);
  if (state !== state) {
    return true;
  }
  return state === 1;
};

var resetSession = function() {
  exercise = 1;
  counts = [];
  totalSets = 0;
  lastSetAt = -9999;
  restStart = 0;
  alerted = false;
};

var saveSession = function() {
  var data = {
    v: 1,
    exercise: exercise,
    counts: counts,
    lastSetAt: lastSetAt,
    restStart: restStart,
    restTarget: restTarget,
    alerted: alerted
  };

  var saved = false;
  try {
    if (localStorage.setObject) {
      localStorage.setObject(SESSION_KEY, data);
      saved = true;
    }
  }
  catch (e) {
    saved = false;
  }

  if (!saved) {
    try {
      localStorage.setItem(
        SESSION_KEY,
        "v1;" + exercise + ";" + restTarget + ";" + lastSetAt + ";" + restStart +
        ";" + (alerted ? 1 : 0) + ";" + counts.join(",")
      );
    }
    catch (e) {
    }
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

  if ((!data || typeof data !== "object") && localStorage.getItem) {
    var raw = localStorage.getItem(SESSION_KEY);
    if (raw && typeof raw === "string" && raw.indexOf("v1;") === 0) {
      var parts = raw.split(";");
      if (parts.length >= 7) {
        var csv = parts[6];
        var parsedCounts = [];
        if (csv !== "") {
          var tokens = csv.split(",");
          for (var t = 0; t < tokens.length; t++) {
            parsedCounts.push(Number(tokens[t]));
          }
        }
        data = {
          v: 1,
          exercise: Number(parts[1]),
          restTarget: Number(parts[2]),
          lastSetAt: Number(parts[3]),
          restStart: Number(parts[4]),
          alerted: parts[5] === "1",
          counts: parsedCounts
        };
      }
    }
  }

  if (!data || typeof data !== "object" || data.v !== 1) {
    return false;
  }

  exercise = Math.floor(clampNumber(data.exercise, 1, MAX_EXERCISE, 1));
  restTarget = Math.floor(clampNumber(data.restTarget, 0, 600, restTarget));
  lastSetAt = Number(data.lastSetAt);
  if (lastSetAt !== lastSetAt) {
    lastSetAt = -9999;
  }
  restStart = Number(data.restStart);
  if (restStart !== restStart) {
    restStart = 0;
  }
  alerted = data.alerted ? true : false;

  counts = [];
  totalSets = 0;
  if (data.counts && typeof data.counts.length === "number") {
    for (var i = 0; i < data.counts.length; i++) {
      var value = Math.floor(Number(data.counts[i]));
      if (value !== value || value < 0) {
        value = 0;
      }
      counts.push(value);
      totalSets += value;
    }
  }

  return true;
};

var clearSession = function() {
  try {
    if (localStorage.removeItem) {
      localStorage.removeItem(SESSION_KEY);
    }
    else {
      localStorage.setItem(SESSION_KEY, "");
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

var recordSet = function(duration) {
  var now = Number(duration);
  if (now !== now) {
    return;
  }

  if (lastSetAt > -9999 && now - lastSetAt < MIN_SET_GAP) {
    return;
  }

  if (exercise < 1) {
    exercise = 1;
  }
  if (exercise > MAX_EXERCISE) {
    exercise = MAX_EXERCISE;
  }

  var index = exercise - 1;
  var currentCount = Number(counts[index]);
  if (currentCount !== currentCount || currentCount < 0) {
    currentCount = 0;
  }
  counts[index] = currentCount + 1;
  totalSets += 1;
  lastSetAt = now;
  restStart = now;
  alerted = false;

  saveSession();
  triggerLap();
};

var nextExercise = function() {
  if (exercise < MAX_EXERCISE) {
    exercise += 1;
    saveSession();
  }
};

var applyUiState = function(state) {
  if ('{{ IS_UI2 }}' != '1') {
    return;
  }

  try {
    setStyle('#ready-label', 'visibility', state === 0 ? 'VISIBLE' : 'HIDDEN');
    setStyle('#ready-timer', 'visibility', state === 0 ? 'VISIBLE' : 'HIDDEN');
    setStyle('#rest-label', 'visibility', state === 1 ? 'VISIBLE' : 'HIDDEN');
    setStyle('#rest-timer', 'visibility', state === 1 ? 'VISIBLE' : 'HIDDEN');
    setStyle('#over-label', 'visibility', state === 2 ? 'VISIBLE' : 'HIDDEN');
    setStyle('#over-timer', 'visibility', state === 2 ? 'VISIBLE' : 'HIDDEN');
  }
  catch (e) {
  }
};

var computeAndSet = function(duration, output) {
  var state = 0;
  var rest = 0;
  var restDisplay = null;
  var overtime = 0;

  if (totalSets > 0) {
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
      restDisplay = rest;
    }
    else {
      state = 2;
      rest = 0;
      overtime = Math.floor(elapsed - restTarget);
      if (overtime < 0) {
        overtime = 0;
      }
      // UI1 has only one rest field: show the overtime count-up there too.
      restDisplay = overtime;
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

  if (output) {
    output.exercise = exercise;
    output.exercise_sets = getExerciseSets();
    output.total_sets = totalSets;
    output.rest = rest;
    output.rest_display = restDisplay;
    output.rest_overtime = overtime;
    output.state = state;
  }

  applyUiState(state);
};

function onLoad(input, output) {
  currentDuration = (input && input.duration !== undefined) ? Number(input.duration) : 0;
  if (currentDuration !== currentDuration) {
    currentDuration = 0;
  }

  resetSession();

  var restored = false;
  if (currentDuration > 0) {
    restored = loadSession();
  }

  // Settings are authoritative for the rest target, even after a restore.
  readSettings();

  if (restored && (lastSetAt > currentDuration + 1 || restStart > currentDuration + 1)) {
    resetSession();
    restored = false;
  }

  if (restored && totalSets > 0) {
    computeAndSet(currentDuration, output);
  }
  else if (output) {
    output.exercise = exercise;
    output.exercise_sets = 0;
    output.total_sets = 0;
    output.rest = 0;
    output.rest_display = null;
    output.rest_overtime = 0;
    output.state = 0;
    applyUiState(0);
  }
}

function onExerciseStart(input, output) {
  currentDuration = (input && input.duration !== undefined) ? Number(input.duration) : 0;
  if (currentDuration !== currentDuration) {
    currentDuration = 0;
  }

  readSettings();
  resetSession();
  clearSession();

  if (output) {
    output.exercise = 1;
    output.exercise_sets = 0;
    output.total_sets = 0;
    output.rest = 0;
    output.rest_display = null;
    output.rest_overtime = 0;
    output.state = 0;
    applyUiState(0);
  }
}

function onExercisePause(input, output) {
}

function onExerciseContinue(input, output) {
}

function onExerciseEnd(input, output) {
  clearSession();
}

function onEvent(input, output, eventId) {
  if (input && input.duration !== undefined) {
    currentDuration = Number(input.duration);
    if (currentDuration !== currentDuration) {
      currentDuration = 0;
    }
  }

  var id = Number(eventId);

  if (id === 1) {
    if (!isRunning(input)) {
      return;
    }
    recordSet(currentDuration);
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

  if (input && input.duration !== undefined) {
    currentDuration = Number(input.duration);
    if (currentDuration !== currentDuration) {
      currentDuration = 0;
    }
  }

  recordSet(currentDuration);
  computeAndSet(currentDuration, output);
}

function evaluate(input, output) {
  if (input && input.duration !== undefined) {
    currentDuration = Number(input.duration);
    if (currentDuration !== currentDuration) {
      currentDuration = 0;
    }
  }

  computeAndSet(currentDuration, output);
}

function getUserInterface(input, output) {
  if ('{{ IS_UI1 }}' == '1') {
    return {
      template: 't-legacy',
      tl: { input: 'output/exercise', format: 'Count_Fourdigits' },
      tr: { input: 'output/exercise_sets', format: 'Count_Fourdigits' },
      ml: { input: 'output/rest_display', format: 'Duration_FourdigitsFixed' },
      mr: { input: 'output/total_sets', format: 'Count_Fourdigits' },
      bottom: { input: 'Activity/Move/-1/Duration/Current', format: 'Duration_FourdigitsFixed' }
    };
  }

  return {
    template: 't'
  };
}

function getSummaryOutputs(input, output) {
  if (totalSets <= 0) {
    return [];
  }

  var exercisesUsed = 0;
  for (var i = 0; i < counts.length; i++) {
    if (counts[i] > 0) {
      exercisesUsed += 1;
    }
  }

  var duration = currentDuration;
  if (input && input.duration !== undefined) {
    duration = Number(input.duration);
  }
  if (duration !== duration) {
    duration = currentDuration;
  }

  return [
    {
      id: 's',
      name: 'Sets',
      format: 'Count_Fourdigits',
      value: totalSets
    },
    {
      id: 'e',
      name: 'Exercises used',
      format: 'Count_Threedigits',
      value: exercisesUsed
    },
    {
      id: 't',
      name: 'Session time',
      format: 'Duration_FourdigitsFixed',
      value: duration
    }
  ];
}
