/**
 * SignBridge — Real-Time ASL Finger Spelling Translator
 * Uses MediaPipe Hands for landmark detection and geometric rules for ASL classification.
 */

const ASL_IMAGE_URLS = {
  A: "https://upload.wikimedia.org/wikipedia/commons/2/27/Sign_language_A.svg",
  B: "https://upload.wikimedia.org/wikipedia/commons/1/18/Sign_language_B.svg",
  C: "https://upload.wikimedia.org/wikipedia/commons/e/e3/Sign_language_C.svg",
  D: "https://upload.wikimedia.org/wikipedia/commons/0/06/Sign_language_D.svg",
  E: "https://upload.wikimedia.org/wikipedia/commons/c/cd/Sign_language_E.svg",
  F: "https://upload.wikimedia.org/wikipedia/commons/8/8f/Sign_language_F.svg",
  G: "https://upload.wikimedia.org/wikipedia/commons/d/d9/Sign_language_G.svg",
  H: "https://upload.wikimedia.org/wikipedia/commons/9/97/Sign_language_H.svg",
  I: "https://upload.wikimedia.org/wikipedia/commons/1/10/Sign_language_I.svg",
  J: "https://upload.wikimedia.org/wikipedia/commons/b/b1/Sign_language_J.svg",
  K: "https://upload.wikimedia.org/wikipedia/commons/9/97/Sign_language_K.svg",
  L: "https://upload.wikimedia.org/wikipedia/commons/d/d2/Sign_language_L.svg",
  M: "https://upload.wikimedia.org/wikipedia/commons/c/c4/Sign_language_M.svg",
  N: "https://upload.wikimedia.org/wikipedia/commons/e/e6/Sign_language_N.svg",
  O: "https://upload.wikimedia.org/wikipedia/commons/e/e0/Sign_language_O.svg",
  P: "https://upload.wikimedia.org/wikipedia/commons/0/08/Sign_language_P.svg",
  Q: "https://upload.wikimedia.org/wikipedia/commons/3/34/Sign_language_Q.svg",
  R: "https://upload.wikimedia.org/wikipedia/commons/3/3d/Sign_language_R.svg",
  S: "https://upload.wikimedia.org/wikipedia/commons/3/3f/Sign_language_S.svg",
  T: "https://upload.wikimedia.org/wikipedia/commons/1/13/Sign_language_T.svg",
  U: "https://upload.wikimedia.org/wikipedia/commons/7/7c/Sign_language_U.svg",
  V: "https://upload.wikimedia.org/wikipedia/commons/c/ca/Sign_language_V.svg",
  W: "https://upload.wikimedia.org/wikipedia/commons/8/83/Sign_language_W.svg",
  X: "https://upload.wikimedia.org/wikipedia/commons/b/b7/Sign_language_X.svg",
  Y: "https://upload.wikimedia.org/wikipedia/commons/1/1d/Sign_language_Y.svg",
  Z: "https://upload.wikimedia.org/wikipedia/commons/0/0a/Sign_language_Z.svg",
};

const ASL_DESCRIPTIONS = {
  A: "Fist, thumb beside index",
  B: "Flat hand, fingers up",
  C: "Curved cup — thumb & fingers apart",
  D: "Index up, others curled",
  E: "Fingers curled down",
  F: "Index & thumb touch, others up",
  G: "Index & thumb horizontal",
  H: "Index & middle horizontal",
  I: "Pinky up, fist",
  J: "Pinky up, trace J",
  K: "Index & middle up, thumb between",
  L: "L shape, thumb & index",
  M: "Three fingers over thumb",
  N: "Two fingers over thumb",
  O: "Fingers curved to O",
  P: "K shape pointing down",
  Q: "G shape pointing down",
  R: "Index crossed over middle finger",
  S: "Fist, thumb across fingers",
  T: "Fist, thumb between index & middle",
  U: "Index & middle up together",
  V: "Index & middle spread (peace)",
  W: "Three fingers up spread",
  X: "Index hooked/bent",
  Y: "Thumb & pinky out",
  Z: "Index traces Z",
};

const WORD_SUGGESTIONS = {
  HI: ["Hello", "Hi there"],
  HEL: ["Hello", "Help"],
  HELLO: ["Hello!"],
  YES: ["Yes"],
  NO: ["No"],
  THANK: ["Thank you"],
  THANKS: ["Thanks"],
  LOVE: ["Love"],
  HELP: ["Help"],
  WATER: ["Water"],
  FOOD: ["Food"],
  NAME: ["Name"],
  GOOD: ["Good"],
  BYE: ["Goodbye", "Bye"],
};

// DOM elements
const video = document.getElementById("webcam");
const canvas = document.getElementById("overlay");
const ctx = canvas.getContext("2d");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const clearBtn = document.getElementById("clearBtn");
const copyBtn = document.getElementById("copyBtn");
const speakBtn = document.getElementById("speakBtn");
const textOutput = document.getElementById("textOutput");
const currentLetterEl = document.getElementById("currentLetter");
const confidenceEl = document.getElementById("confidence");
const fpsEl = document.getElementById("fps");
const statusBadge = document.getElementById("statusBadge");
const statusText = document.getElementById("statusText");
const cameraPlaceholder = document.getElementById("cameraPlaceholder");
const autoSpaceCheckbox = document.getElementById("autoSpace");
const showLandmarksCheckbox = document.getElementById("showLandmarks");
const wordSuggestionsEl = document.getElementById("wordSuggestions");
const alphabetGrid = document.getElementById("alphabetGrid");

let hands = null;
let camera = null;
let isRunning = false;
let translatedText = "";
let lastAddedLetter = "";
let lastAddTime = 0;
let holdStartTime = null;
let holdLetter = null;
const HOLD_DURATION_MS = 900;
const SAME_LETTER_COOLDOWN_MS = 1200;
let frameCount = 0;
let lastFpsTime = performance.now();
const detectionHistory = [];
const DETECTION_HISTORY_SIZE = 7;
const DETECTION_MAJORITY = 4;

function setStatus(state, text) {
  statusBadge.className = "status-badge " + state;
  statusText.textContent = text;
}

function initAlphabetGrid() {
  alphabetGrid.innerHTML = "";
  for (const [letter, desc] of Object.entries(ASL_DESCRIPTIONS)) {
    const cell = document.createElement("div");
    cell.className = "alphabet-cell";
    const imgUrl = ASL_IMAGE_URLS[letter];
    cell.innerHTML = `
      <img
        class="alphabet-sign-img"
        src="${imgUrl}"
        alt="ASL sign for letter ${letter}"
        loading="lazy"
        width="72"
        height="96"
      />
      <span class="alphabet-letter">${letter}</span>
      <span class="alphabet-desc">${desc}</span>
    `;
    alphabetGrid.appendChild(cell);
  }
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getCurlRatio(landmarks, tipIdx, pipIdx, wrist = 0) {
  const tipDist = distance(landmarks[tipIdx], landmarks[wrist]);
  const pipDist = distance(landmarks[pipIdx], landmarks[wrist]);
  if (pipDist < 1e-6) return 1;
  return tipDist / pipDist;
}

function isFingerExtended(landmarks, tipIdx, pipIdx, wrist) {
  return getCurlRatio(landmarks, tipIdx, pipIdx, wrist) > 1.05;
}

function isFingerCurved(landmarks, tipIdx, pipIdx, wrist = 0) {
  const ratio = getCurlRatio(landmarks, tipIdx, pipIdx, wrist);
  return ratio >= 0.86 && ratio <= 1.1;
}

function isFingerCurled(landmarks, tipIdx, pipIdx, wrist = 0) {
  return getCurlRatio(landmarks, tipIdx, pipIdx, wrist) < 0.88;
}

function fingerParallelCos(landmarks, mcpA, tipA, mcpB, tipB) {
  const ax = landmarks[tipA].x - landmarks[mcpA].x;
  const ay = landmarks[tipA].y - landmarks[mcpA].y;
  const bx = landmarks[tipB].x - landmarks[mcpB].x;
  const by = landmarks[tipB].y - landmarks[mcpB].y;
  const mag = Math.hypot(ax, ay) * Math.hypot(bx, by);
  if (mag < 1e-6) return 1;
  return (ax * bx + ay * by) / mag;
}

function indexMiddleExtendedEnough(landmarks) {
  return getCurlRatio(landmarks, 8, 6) > 0.82 && getCurlRatio(landmarks, 12, 10) > 0.82;
}

function isRSign(landmarks, f) {
  if (f.ring || f.pinky) return false;
  if (!indexMiddleExtendedEnough(landmarks)) return false;

  const tipDist = distance(landmarks[8], landmarks[12]);
  const dipDist = distance(landmarks[7], landmarks[11]);
  const parallel = fingerParallelCos(landmarks, 5, 8, 9, 12);

  // U = fingers side-by-side pointing same way; R = crossed / overlapping
  if (parallel > 0.78 && Math.abs(landmarks[8].x - landmarks[12].x) > 0.012) {
    return false;
  }

  const indexCrossesMiddle =
    distance(landmarks[8], landmarks[11]) < 0.05 ||
    distance(landmarks[7], landmarks[10]) < 0.055 ||
    dipDist < 0.048;

  const tipsOverlap = tipDist < 0.038;
  const notParallel = parallel < 0.72;

  return indexCrossesMiddle || (tipsOverlap && notParallel);
}

function isCSign(landmarks, f) {
  const fingersCurved = [
    isFingerCurved(landmarks, 8, 6),
    isFingerCurved(landmarks, 12, 10),
    isFingerCurved(landmarks, 16, 14),
    isFingerCurved(landmarks, 20, 18),
  ];
  const curvedCount = fingersCurved.filter(Boolean).length;
  if (curvedCount < 3) return false;

  // Reject flat open hand (B) and tight circle (O)
  if (f.index && f.middle && f.ring && f.pinky && !f.thumb) return false;
  if (isFingerCurled(landmarks, 8, 6) && isFingerCurled(landmarks, 12, 10) &&
      distance(landmarks[8], landmarks[12]) < 0.035) return false;

  const thumbGap = distance(landmarks[4], landmarks[5]);
  const thumbOpen = thumbGap > 0.05 && thumbGap < 0.17;
  const fingertipsUp =
    (landmarks[8].y + landmarks[12].y + landmarks[16].y) / 3 < landmarks[0].y + 0.02;

  return thumbOpen && fingertipsUp;
}

function isUSign(landmarks, f) {
  if (f.ring || f.pinky) return false;
  if (!f.index || !f.middle) return false;

  const tipDist = distance(landmarks[8], landmarks[12]);
  const parallel = fingerParallelCos(landmarks, 5, 8, 9, 12);

  return tipDist < 0.045 && parallel > 0.78 && !isRSign(landmarks, f);
}

function getFingerStates(landmarks) {
  return {
    thumb: isFingerExtended(landmarks, 4, 3, 0),
    index: isFingerExtended(landmarks, 8, 6, 0),
    middle: isFingerExtended(landmarks, 12, 10, 0),
    ring: isFingerExtended(landmarks, 16, 14, 0),
    pinky: isFingerExtended(landmarks, 20, 18, 0),
  };
}

function thumbExtendedSideways(landmarks) {
  const thumbTip = landmarks[4];
  const indexMcp = landmarks[5];
  const wrist = landmarks[0];
  const thumbOut = distance(thumbTip, indexMcp) > distance(landmarks[3], indexMcp) * 0.85;
  const thumbAway = thumbTip.x < wrist.x - 0.02 || thumbTip.x > wrist.x + 0.02;
  return thumbOut && thumbAway;
}

function fingersTouch(landmarks, i, j, threshold = 0.045) {
  return distance(landmarks[i], landmarks[j]) < threshold;
}

function smoothDetection(letter, confidence) {
  if (!letter) {
    detectionHistory.length = 0;
    return { letter: null, confidence: 0 };
  }

  detectionHistory.push(letter);
  if (detectionHistory.length > DETECTION_HISTORY_SIZE) {
    detectionHistory.shift();
  }

  const counts = {};
  for (const l of detectionHistory) {
    counts[l] = (counts[l] || 0) + 1;
  }

  let bestLetter = letter;
  let bestCount = 0;
  for (const [l, count] of Object.entries(counts)) {
    if (count > bestCount) {
      bestCount = count;
      bestLetter = l;
    }
  }

  if (bestCount >= DETECTION_MAJORITY) {
    return {
      letter: bestLetter,
      confidence: confidence * (bestCount / detectionHistory.length),
    };
  }

  return { letter: null, confidence: 0 };
}

function classifyASL(landmarks) {
  const f = getFingerStates(landmarks);
  const extendedCount = [f.thumb, f.index, f.middle, f.ring, f.pinky].filter(Boolean).length;

  const indexTip = landmarks[8];
  const middleTip = landmarks[12];
  const thumbTip = landmarks[4];
  const wrist = landmarks[0];

  const indexMiddleDist = distance(indexTip, middleTip);
  const thumbIndexDist = distance(thumbTip, indexTip);

  // O — all fingers curled, tips near each other
  const tipsNear =
    distance(landmarks[8], landmarks[12]) < 0.04 &&
    distance(landmarks[12], landmarks[16]) < 0.04 &&
    distance(landmarks[16], landmarks[20]) < 0.04;
  if (!f.index && !f.middle && !f.ring && !f.pinky && tipsNear) {
    return { letter: "O", confidence: 0.88 };
  }

  // S — fist, no fingers extended
  if (!f.index && !f.middle && !f.ring && !f.pinky && !thumbExtendedSideways(landmarks)) {
    return { letter: "S", confidence: 0.85 };
  }

  // A — fist with thumb beside (not extended sideways)
  if (!f.index && !f.middle && !f.ring && !f.pinky && thumbTip.x > wrist.x - 0.05) {
    return { letter: "A", confidence: 0.82 };
  }

  // I — only pinky extended
  if (f.pinky && !f.index && !f.middle && !f.ring) {
    return { letter: "I", confidence: 0.9 };
  }

  // Y — thumb and pinky extended
  if (f.pinky && f.thumb && !f.index && !f.middle && !f.ring) {
    return { letter: "Y", confidence: 0.88 };
  }

  // L — thumb and index extended, others curled
  if (f.index && f.thumb && !f.middle && !f.ring && !f.pinky && thumbIndexDist > 0.08) {
    return { letter: "L", confidence: 0.9 };
  }

  // C — curved cup shape (check before other partial-hand signs)
  if (isCSign(landmarks, f)) {
    return { letter: "C", confidence: 0.82 };
  }

  // R — crossed index & middle (must be before U)
  if (isRSign(landmarks, f)) {
    return { letter: "R", confidence: 0.84 };
  }

  // V — index and middle spread
  if (f.index && f.middle && !f.ring && !f.pinky && indexMiddleDist > 0.06) {
    return { letter: "V", confidence: 0.88 };
  }

  // U — index and middle parallel together
  if (isUSign(landmarks, f)) {
    return { letter: "U", confidence: 0.88 };
  }

  // W — three fingers up
  if (f.index && f.middle && f.ring && !f.pinky) {
    return { letter: "W", confidence: 0.85 };
  }

  // B — four fingers up, thumb tucked
  if (f.index && f.middle && f.ring && f.pinky && !f.thumb) {
    return { letter: "B", confidence: 0.85 };
  }

  // D — only index up
  if (f.index && !f.middle && !f.ring && !f.pinky) {
    return { letter: "D", confidence: 0.88 };
  }

  // X — index bent (tip closer to wrist than pip but not fully extended)
  const indexPip = landmarks[6];
  const indexTipDist = distance(indexTip, wrist);
  const indexPipDist = distance(indexPip, wrist);
  if (!f.index && indexTipDist > indexPipDist * 0.85 && indexTipDist < indexPipDist * 1.05) {
    return { letter: "X", confidence: 0.7 };
  }

  // F — thumb and index touch, middle/ring/pinky up
  if (fingersTouch(landmarks, 4, 8) && f.middle && f.ring && f.pinky) {
    return { letter: "F", confidence: 0.78 };
  }

  // E — all fingers curled toward palm
  if (!f.index && !f.middle && !f.ring && !f.pinky && extendedCount === 0) {
    return { letter: "E", confidence: 0.6 };
  }

  // G — index and thumb horizontal (pointing sideways)
  if (f.index && f.thumb && !f.middle && thumbIndexDist < 0.07) {
    const horizontal = Math.abs(thumbTip.y - indexTip.y) < 0.04;
    if (horizontal) return { letter: "G", confidence: 0.72 };
  }

  // H — index and middle horizontal
  if (f.index && f.middle && !f.ring && indexMiddleDist < 0.04) {
    const horizontal = Math.abs(indexTip.y - middleTip.y) < 0.03;
    if (horizontal && indexTip.y < wrist.y) return { letter: "H", confidence: 0.7 };
  }

  // K — index & middle up, thumb between
  if (f.index && f.middle && f.thumb && thumbTip.y < landmarks[9].y) {
    return { letter: "K", confidence: 0.68 };
  }

  // M, N — fingers over thumb
  if (!f.index && !f.middle && thumbTip.y > wrist.y) {
    const indexOverThumb = landmarks[8].y > thumbTip.y;
    const middleOverThumb = landmarks[12].y > thumbTip.y;
    if (indexOverThumb && middleOverThumb && landmarks[16].y > thumbTip.y) {
      return { letter: "M", confidence: 0.65 };
    }
    if (indexOverThumb && middleOverThumb) {
      return { letter: "N", confidence: 0.65 };
    }
  }

  // T — thumb between index and middle
  if (!f.index && !f.middle && thumbTip.y > landmarks[5].y && thumbTip.y < landmarks[9].y) {
    return { letter: "T", confidence: 0.6 };
  }

  return { letter: null, confidence: 0 };
}

function updateTextDisplay(appendLetter = false) {
  if (translatedText.length === 0) {
    textOutput.innerHTML = '<span class="placeholder-text">Your translated text will appear here…</span>';
  } else {
    textOutput.textContent = translatedText;
    if (appendLetter) {
      textOutput.classList.add("letter-flash");
      setTimeout(() => textOutput.classList.remove("letter-flash"), 350);
    }
  }
  updateWordSuggestions();
}

function updateWordSuggestions() {
  wordSuggestionsEl.innerHTML = "";
  const upper = translatedText.trim().toUpperCase();
  if (!upper) return;

  const suggestions = WORD_SUGGESTIONS[upper];
  if (suggestions) {
    suggestions.forEach((word) => {
      const chip = document.createElement("button");
      chip.className = "suggestion-chip";
      chip.textContent = word;
      chip.type = "button";
      chip.addEventListener("click", () => {
        translatedText = word + " ";
        updateTextDisplay();
      });
      wordSuggestionsEl.appendChild(chip);
    });
  }
}

function addLetter(letter) {
  if (!letter || !autoSpaceCheckbox.checked) return;
  const now = performance.now();
  if (letter === lastAddedLetter && now - lastAddTime < SAME_LETTER_COOLDOWN_MS) return;

  translatedText += letter;
  lastAddedLetter = letter;
  lastAddTime = now;
  updateTextDisplay(true);
  holdStartTime = null;
  holdLetter = null;
}

function processDetection(result) {
  frameCount++;
  const now = performance.now();
  if (now - lastFpsTime >= 1000) {
    fpsEl.textContent = frameCount;
    frameCount = 0;
    lastFpsTime = now;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!result.multiHandLandmarks || result.multiHandLandmarks.length === 0) {
    currentLetterEl.textContent = "—";
    confidenceEl.textContent = "—";
    holdStartTime = null;
    holdLetter = null;
    detectionHistory.length = 0;
    return;
  }

  const landmarks = result.multiHandLandmarks[0];

  if (showLandmarksCheckbox.checked) {
    drawConnectors(ctx, landmarks, HAND_CONNECTIONS, { color: "#38bdf8", lineWidth: 2 });
    drawLandmarks(ctx, landmarks, { color: "#818cf8", lineWidth: 1, radius: 3 });
  }

  const raw = classifyASL(landmarks);
  const { letter, confidence } = smoothDetection(raw.letter, raw.confidence);

  if (letter) {
    currentLetterEl.textContent = letter;
    confidenceEl.textContent = Math.round(confidence * 100) + "%";

    if (autoSpaceCheckbox.checked) {
      if (letter === holdLetter) {
        if (!holdStartTime) holdStartTime = now;
        const held = now - holdStartTime;
        if (held >= HOLD_DURATION_MS) {
          addLetter(letter);
          holdStartTime = now + 500;
        }
      } else {
        holdLetter = letter;
        holdStartTime = now;
      }
    }
  } else {
    currentLetterEl.textContent = "?";
    confidenceEl.textContent = "Low";
    holdStartTime = null;
    holdLetter = null;
  }
}

async function initHands() {
  hands = new Hands({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
  });

  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.6,
  });

  hands.onResults(processDetection);
  setStatus("ready", "Ready");
}

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });

    video.srcObject = stream;
    await video.play();

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    cameraPlaceholder.classList.add("hidden");
    isRunning = true;
    startBtn.disabled = true;
    stopBtn.disabled = false;
    setStatus("active", "Translating");

    camera = new Camera(video, {
      onFrame: async () => {
        if (hands && isRunning) {
          await hands.send({ image: video });
        }
      },
      width: 640,
      height: 480,
    });
    camera.start();
  } catch (err) {
    console.error(err);
    setStatus("error", "Camera denied");
    alert("Could not access camera. Please allow camera permissions and try again.");
  }
}

function stopCamera() {
  isRunning = false;
  if (camera) {
    camera.stop();
    camera = null;
  }
  if (video.srcObject) {
    video.srcObject.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  cameraPlaceholder.classList.remove("hidden");
  startBtn.disabled = false;
  stopBtn.disabled = true;
  setStatus("ready", "Ready");
  detectionHistory.length = 0;
  currentLetterEl.textContent = "—";
  confidenceEl.textContent = "—";
  fpsEl.textContent = "—";
}

startBtn.addEventListener("click", startCamera);
stopBtn.addEventListener("click", stopCamera);

clearBtn.addEventListener("click", () => {
  translatedText = "";
  lastAddedLetter = "";
  updateTextDisplay();
});

copyBtn.addEventListener("click", async () => {
  if (!translatedText) return;
  try {
    await navigator.clipboard.writeText(translatedText);
    copyBtn.textContent = "✓";
    setTimeout(() => (copyBtn.textContent = "📋"), 1500);
  } catch {
    alert("Could not copy text.");
  }
});

speakBtn.addEventListener("click", () => {
  if (!translatedText || !window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(translatedText);
  utterance.rate = 0.95;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
});

initAlphabetGrid();
setStatus("", "Initializing…");
initHands().catch((err) => {
  console.error(err);
  setStatus("error", "Load failed");
});
