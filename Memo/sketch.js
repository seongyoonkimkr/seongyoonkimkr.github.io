// p5.js + Matter.js
// 메모 루틴: 내용과 반복 횟수를 입력하면 일정 간격으로 메모가 생성.
// 짧게 누르기 = 원형(.) / 길게 누르기 = 긴 직사각형(-)

const Engine = Matter.Engine;
const Bodies = Matter.Bodies;
const Composite = Matter.Composite;
const Body = Matter.Body;

let engine;
let memos = [];
let fragments = [];
let floorFragments = [];
let routines = [];
let touchMarks = [];

let taskInput;
let countInput;
let addButton;

let selectedMemo = null;
let selectedMemoAt = 0;
let isTouchingFloor = false;
let touchStart = 0;
let enteredPattern = "";
let lastPatternInputAt = 0;
let patternCompletedAt = 0;
let completedPatternMemo = null;
let completedPatternScreen = null;

let nextPattern = 0;
let nextLane = 0;
let memoLanes = {};
let memoPatterns = {};

let homeButtonY = 0;
let homeButtonW = 180;
let homeButtonH = 54;

const PATTERNS = [
  "·-··-",
  "--·-·",
  "·--·-",
  "-··--",
  "··---",
  "·-·-·",
  "--··-",
  "··-··",
  "-·--·",
  "·---·",
];

const MAX_MEMOS = 30;
const MAX_FRAGMENTS = 60;
const RESET_SAVED_DATA_ON_START = false;

// 메모 디자인
const boxW = 180;
const boxH = 100;
const MEMO_START_GAP = 10;
const STACK_GAP = 24;
const SIDE_MARGIN = 60;

// 동작 조절
// 루틴 한 묶음이 완료되는 데 걸리는 목표 시간
const ROUTINE_DURATION_MS = 300000;

// 메모의 계단식 이동 거리
const STEP_SIZE = 18;

const TOUCH_ZONE_HEIGHT = 200;
const BREAK_LINE_OFFSET = 240;

let breakLine;
let touchZoneTop;
let memoStartLine;

let canvas;

// 화면 전환
let screenMode = "home"; // home, routine, archive

// 보관함에 들어간 메모
let archivedMemos = [];
let selectedArchivedMemo = null;

// 우측 상단 버튼 영역
const NAV_BUTTON_W = 110;
const NAV_BUTTON_H = 38;
const NAV_GAP = 10;

////////////////////////////////

function setup() {
  canvas = createCanvas(windowWidth, windowHeight);
  canvas.position(0, 0);
  canvas.style("z-index", "0");

  textAlign(CENTER, CENTER);
  rectMode(CENTER);

  engine = Engine.create();
  engine.world.gravity.y = 0;

  function setupInput(element, left, width) {
    element.position(left, 20);
    element.size(width, 28);
    element.elt.style.boxSizing = "border-box";
    element.elt.style.margin = "0";

    element.elt.style.position = "fixed";
    element.elt.style.zIndex = "10000";
    element.elt.style.pointerEvents = "auto";
    element.elt.style.fontSize = "14px";
    element.elt.style.userSelect = "text";

    element.elt.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      element.elt.focus();
    });
  }

  // 메모 내용 입력창
  taskInput = createInput("");
  taskInput.attribute("placeholder", "메모 내용을 입력하세요");
  setupInput(taskInput, 20, 220);

  // 루틴 반복 횟수 입력창
  countInput = createInput("1", "number");
  countInput.attribute("min", "1");
  countInput.attribute("max", "10");
  countInput.attribute("step", "1");
  setupInput(countInput, 250, 65);

  // 루틴 추가 버튼
  addButton = createButton("루틴 추가");
  addButton.position(330, 20);
  addButton.elt.style.minHeight = "28px";
  addButton.elt.style.position = "fixed";
  addButton.elt.style.zIndex = "10000";
  addButton.elt.style.pointerEvents = "auto";
  addButton.elt.style.padding = "0";
  addButton.mousePressed(addRoutine);
  layoutTopControls();

  updateLayout();
  createFloorFragments();

  if (RESET_SAVED_DATA_ON_START) {
    localStorage.removeItem("dailyRoutineMemos");
    memos = [];
    fragments = [];
    routines = [];
  } else {
    loadMemos();
  }

  updateTopControlsVisibility();
}

function layoutTopControls() {
  const groupWidth = 395;
  const left = Math.max(10, (width - groupWidth) / 2);

  taskInput.position(left, 20);
  taskInput.size(240, 40);

  countInput.position(left + 248, 20);
  countInput.size(50, 40);

  addButton.position(left + 305, 20);
  addButton.size(90, 40);
  addButton.elt.style.boxSizing = "border-box";
  addButton.elt.style.margin = "0";
  addButton.elt.style.lineHeight = "normal";
}

function updateLayout() {
  memoStartLine = 75;
  breakLine = height - BREAK_LINE_OFFSET;
  touchZoneTop = height - TOUCH_ZONE_HEIGHT;
}

function addRoutine() {
  const txt = taskInput.value().trim();
  const count = Math.floor(Number(countInput.value()));

  if (!txt) {
    alert("메모 내용을 입력해 주세요.");
    taskInput.elt.focus();
    return;
  }

  if (!Number.isFinite(count) || count < 1) {
    alert("반복 횟수를 1 이상으로 입력해 주세요.");
    countInput.value("1");
    return;
  }

  const pendingCount = routines.reduce(
    (sum, r) => sum + (Number(r.remaining) || 0),
    0,
  );

  if (memos.length + pendingCount + count > MAX_MEMOS) {
    alert(
      `메모 개수 제한에 도달했어요.\n` +
        `현재 메모: ${memos.length}개\n` +
        `예정된 메모: ${pendingCount}개\n` +
        `추가 요청: ${count}개\n` +
        `최대: ${MAX_MEMOS}개`,
    );
    return;
  }

  const laneX = getLaneXForText(txt);

  if (laneX === null || !Number.isFinite(laneX)) {
    alert("메모를 배치할 공간이 없어요.");
    return;
  }

  const routine = {
    txt,
    total: count,
    remaining: count,
    nextSpawnAt: millis(),
    created: 0,
    activeMemo: null,
    failedMemos: [],
    laneX,
    waitingForFragments: false,
    pendingBreakMemos: [],
  };

  routines.push(routine);

  screenMode = "routine";
  updateTopControlsVisibility();
  taskInput.value("");
  saveState();

  try {
    spawnMemo(routine);
  } catch (error) {
    console.error("메모 생성 실패:", error);
    alert(
      "루틴은 추가됐지만 메모 생성에 실패했어요. 콘솔 오류를 확인해 주세요.",
    );
  }
}

function getLaneX(txt = null) {
  const spacing = boxW + 24;
  const halfMemo = boxW / 2 + 4;
  const minX = SIDE_MARGIN + halfMemo;
  const maxX = width - SIDE_MARGIN - halfMemo;
  const centerX = width / 2;

  const lanes = [centerX];

  for (let i = 1; ; i++) {
    const leftX = centerX - i * spacing;
    const rightX = centerX + i * spacing;
    let added = false;

    if (leftX >= minX) {
      lanes.push(leftX);
      added = true;
    }

    if (rightX <= maxX) {
      lanes.push(rightX);
      added = true;
    }

    if (!added) break;
  }

  // 다른 문구가 이미 사용 중인 줄 목록
  const usedX = new Set(
    Object.entries(memoLanes)
      .filter(([text]) => text !== txt)
      .map(([, x]) => Number(x)),
  );

  // 현재 화면에 남아 있는 메모의 위치도 확인
  for (const memo of memos) {
    if (memo.txt !== txt) {
      usedX.add(Number(memo.x));
    }
  }

  // 사용하지 않는 첫 번째 줄을 배정
  const laneX = lanes.find(
    (x) => ![...usedX].some((used) => Math.abs(used - x) < 1),
  );

  return laneX === undefined ? null : laneX;
}

function getLaneXForText(txt) {
  // 같은 문구는 기존 줄을 그대로 사용
  const existingMemo = memos.find((memo) => memo.txt === txt);

  if (existingMemo) {
    memoLanes[txt] = existingMemo.x;
    return existingMemo.x;
  }

  // 저장된 줄이 다른 문구와 겹치지 않는지 확인
  const savedX = memoLanes[txt];

  if (savedX !== undefined && savedX !== null) {
    const conflict = Object.entries(memoLanes).some(
      ([otherText, x]) =>
        otherText !== txt && Math.abs(Number(x) - Number(savedX)) < 1,
    );

    if (!conflict) {
      return Number(savedX);
    }
  }

  // 저장된 줄이 겹치면 새로운 줄 배정
  const laneX = getLaneX(txt);

  if (laneX !== null) {
    memoLanes[txt] = laneX;
  }

  return laneX;
}

function getPatternForText(txt) {
  if (memoPatterns[txt] === undefined) {
    memoPatterns[txt] = PATTERNS[nextPattern % PATTERNS.length];
    nextPattern++;
  }

  return memoPatterns[txt];
}

function spawnMemo(routine) {
  if (memos.length >= MAX_MEMOS || routine.remaining <= 0) return;
  if (routine.activeMemo || routine.waitingForFragments) return;

  const x = routine.laneX;
  const startY = memoStartLine + boxH / 2 + MEMO_START_GAP;
  const stack = [...routine.failedMemos].reverse();
  const stackCount = stack.length + 1;
  const stackOffset = boxH + STACK_GAP;

  // 맨 위 카드가 내려갈 목표 위치
  const topTargetY = Math.max(
    startY,
    breakLine - boxH / 2 - (stackCount - 1) * stackOffset,
  );

  const totalSteps = Math.max(1, Math.ceil((topTargetY - startY) / STEP_SIZE));

  const dropDuration = ROUTINE_DURATION_MS / routine.total;
  const stepInterval = Math.max(1, dropDuration / totalSteps);
  const now = millis();

  const body = Bodies.rectangle(x, startY, boxW, boxH, {
    isStatic: true,
    frictionAir: 0.08,
    restitution: 0,
  });

  const memo = {
    txt: routine.txt,
    body,
    x,
    pattern: getPatternForText(routine.txt),
    entered: "",
    speedStep: 0,
    startY,
    targetY: topTargetY,
    nextStepAt: now + stepInterval,
    stepInterval,
    totalSteps,
    broken: false,
    routineNumber: routine.total - routine.remaining + 1,
    routineTotal: routine.total,
    routine,
    stackIndex: 0,
  };

  routine.remaining--;
  routine.activeMemo = memo;
  memos.push(memo);
  Composite.add(engine.world, body);

  // 새 메모를 위에, 미완료 메모를 아래에 배치
  const cards = [memo, ...stack];

  cards.forEach((card, index) => {
    card.stackIndex = index;
    card.hidden = false;
    card.startY = startY + index * stackOffset;
    card.targetY = topTargetY + index * stackOffset;
    card.speedStep = 0;
    card.totalSteps = totalSteps;
    card.stepInterval = stepInterval;
    card.nextStepAt = now + stepInterval;
    card.broken = false;

    Body.setPosition(card.body, {
      x: card.x,
      y: card.startY,
    });
  });

  selectedMemo = memo;
  enteredPattern = "";
  saveState();
}

function createFragments(memo) {
  const routine = memo.routine;
  const p = memo.body.position;
  const available = max(0, MAX_FRAGMENTS - fragments.length);
  const amount = min(12, available);

  for (let i = 0; i < amount; i++) {
    const size = random(5, 12);
    const angle = random(TWO_PI);
    const distance = random(12, 48);

    const body = Bodies.rectangle(
      p.x + Math.cos(angle) * distance * 0.3,
      p.y + Math.sin(angle) * distance * 0.3,
      size,
      size * random(0.45, 0.85),
      {
        restitution: 0.18,
        frictionAir: 0.045,
        friction: 0.08,
      },
    );

    Body.setVelocity(body, {
      x: Math.cos(angle) * random(2, 5),
      y: Math.sin(angle) * random(2, 5) - 0.8,
    });

    Body.setAngularVelocity(body, random(-0.12, 0.12));

    fragments.push({
      body,
      life: 42,
      size,
      color: randomPaletteColor(),
      routine: memo.routine,
    });

    Composite.add(engine.world, body);
  }

  if (memo.routine) {
    memo.routine.waitingForFragments = amount > 0;
  }

  if (routine) {
    routine.waitingForFragments = amount > 0;
  }
}

function startNextBreakMemo(routine) {
  if (!routine || routine.waitingForFragments) return;

  const queue = routine.pendingBreakMemos || [];
  const memo = queue.shift();

  routine.pendingBreakMemos = queue;

  // 파편화할 메모가 더 이상 없으면 다음 메모 예약
  if (!memo) {
    routine.activeMemo = null;

    if (routine.remaining > 0) {
      routine.nextSpawnAt = millis();
    } else {
      archiveFailedMemos(routine);
    }

    saveState();
    return;
  }

  memo.broken = false;
  memo.hidden = false;
  memo.breaking = true;
  memo.targetY = routine.breakTargetY;
  memo.speedStep = 0;

  const currentY = memo.body.position.y;
  const distance = Math.max(0, memo.targetY - currentY);

  memo.totalSteps = Math.max(1, Math.ceil(distance / STEP_SIZE));

  const BREAK_DURATION_MS = 500;

  memo.stepInterval = Math.max(1, BREAK_DURATION_MS / memo.totalSteps);

  memo.nextStepAt = millis() + memo.stepInterval;

  if (currentY >= memo.targetY) {
    Body.setPosition(memo.body, {
      x: memo.x,
      y: memo.targetY,
    });

    memo.totalSteps = 1;
    memo.speedStep = 0;
    memo.nextStepAt = millis();
  }

  routine.activeMemo = memo;
  saveState();
}

function removeMemo(memo, shouldSave = true) {
  const routine = memo.routine;

  if (routine) {
    if (routine.activeMemo === memo) {
      routine.activeMemo = null;
    }

    routine.failedMemos = routine.failedMemos.filter((item) => item !== memo);
  }

  Composite.remove(engine.world, memo.body);
  memos = memos.filter((item) => item !== memo);

  if (selectedMemo === memo) {
    selectedMemo = null;
    enteredPattern = "";
  }

  if (shouldSave) saveState();
}

function archiveFailedMemos(routine) {
  if (
    !routine ||
    routine.remaining > 0 ||
    routine.activeMemo ||
    routine.waitingForFragments
  ) {
    return;
  }

  const unfinished = [...routine.failedMemos];

  for (const memo of unfinished) {
    if (!memos.includes(memo)) continue;

    const alreadyArchived = archivedMemos.some((item) => item.txt === memo.txt);

    if (!alreadyArchived) {
      archivedMemos.push({
        txt: memo.txt,
        pattern: memo.pattern,
        routineNumber: memo.routineNumber,
        routineTotal: memo.routineTotal,
      });
    }

    removeMemo(memo, false);
  }

  routine.failedMemos = [];
  saveState();
}

function randomPaletteColor() {
  const palette = [
    [255, 20, 35], // 선명한 레드
    [220, 0, 35], // 강한 크림슨
    [255, 65, 45], // 오렌지 기가 도는 레드
    [170, 0, 25], // 어두운 레드
    [255, 90, 75], // 밝은 코럴 레드
    [245, 35, 80], // 핑크 기가 도는 레드
  ];

  return random(palette);
}

function updateTopControlsVisibility() {
  const visible = screenMode === "routine";
  const display = visible ? "block" : "none";
  taskInput.elt.style.display = display;
  countInput.elt.style.display = display;
  addButton.elt.style.display = display;
}

function draw() {
  background("#fafaf8");
  updatePatternState();

  if (screenMode === "home") {
    drawHomeScreen();
    return;
  }

  if (screenMode === "archive") {
    drawArchiveScreen();
    return;
  }

  Engine.update(engine);
  updateLayout();
  updateRoutines();

  updateMemos();

  if (
    selectedMemo &&
    enteredPattern.length > 0 &&
    !isTouchingFloor &&
    millis() - lastPatternInputAt >= 10000
  ) {
    enteredPattern = "";
    selectedMemo.entered = "";
    touchMarks = [];
  }

  updateFragments();
  drawFragments();
  drawFragmentPile();
  drawMemos();
  drawMemoStartLine();
  drawFloorArea();
  drawTouchMarks();
  drawStatus();
  drawNavigationButtons();

  if (frameCount % 60 === 0) {
    saveState();
  }
}

function updatePatternState() {
  // 패턴 완성 후 1.5초가 지나면 메모 처리
  if (patternCompletedAt > 0 && millis() - patternCompletedAt >= 1500) {
    const memo = completedPatternMemo;
    const completedScreen = completedPatternScreen;

    patternCompletedAt = 0;
    completedPatternMemo = null;
    completedPatternScreen = null;

    if (completedScreen === "archive" && memo) {
      archivedMemos = archivedMemos.filter((item) => item !== memo);

      if (selectedArchivedMemo === memo) {
        selectedArchivedMemo = null;
      }
    } else if (completedScreen === "routine" && memo) {
      const completedRoutine = memo.routine;

      removeMemo(memo, false);

      if (completedRoutine && completedRoutine.remaining > 0) {
        completedRoutine.nextSpawnAt =
          millis() + ROUTINE_DURATION_MS / completedRoutine.total;
      }
    }

    enteredPattern = "";
    touchMarks = [];
    isTouchingFloor = false;
    saveState();
    return;
  }

  // 완성된 패턴은 1.5초 동안 그대로 유지
  if (patternCompletedAt > 0) return;

  // 10초 동안 추가 입력이 없으면 미완성 패턴 초기화
  if (enteredPattern.length > 0 && millis() - lastPatternInputAt >= 10000) {
    enteredPattern = "";
    touchMarks = [];

    if (selectedMemo) {
      selectedMemo.entered = "";
    }
  }
}

function drawMemoStartLine() {
  stroke(190, 20, 35);
  strokeWeight(1.5);
  line(0, memoStartLine, width, memoStartLine);
}

function updateRoutines() {
  const now = millis();

  for (const routine of routines) {
    if (
      routine.remaining > 0 &&
      !routine.activeMemo &&
      !routine.waitingForFragments &&
      now >= routine.nextSpawnAt
    ) {
    }
  }

  routines = routines.filter(
    (routine) =>
      routine.remaining > 0 ||
      routine.activeMemo ||
      routine.waitingForFragments ||
      (routine.pendingBreakMemos && routine.pendingBreakMemos.length > 0) ||
      routine.failedMemos.length > 0,
  );
}

function updateMemos() {
  const now = millis();

  for (const memo of [...memos]) {
    const routine = memo.routine;

    if (!routine || memo.broken) continue;

    // 파편화 대기 중인 메모도 공통 목표 높이까지 이동
    if (memo.breaking) {
      if (now >= memo.nextStepAt) {
        const currentY = memo.body.position.y;
        const nextY = Math.min(currentY + STEP_SIZE, memo.targetY);

        Body.setPosition(memo.body, {
          x: memo.x,
          y: nextY,
        });

        memo.nextStepAt = now + memo.stepInterval;
      }

      // 메모의 밑변이 공통 목표 높이에 도달했을 때 파편화
      const currentY = memo.body.position.y;

      if (currentY >= memo.targetY - 0.1) {
        memo.breaking = false;
        memo.broken = true;
        memo.hidden = true;

        if (routine.activeMemo === memo) {
          routine.activeMemo = null;
        }

        if (!routine.failedMemos.includes(memo)) {
          routine.failedMemos.push(memo);
        }

        createFragments(memo);
        saveState();
      }

      continue;
    }

    if (now >= memo.nextStepAt) {
      memo.speedStep = Math.min(
        memo.speedStep + STEP_SIZE,
        memo.totalSteps * STEP_SIZE,
      );

      const progress = constrain(
        memo.speedStep / (memo.totalSteps * STEP_SIZE),
        0,
        1,
      );

      memo.nextStepAt = now + memo.stepInterval * (1 - 0.12 * progress);

      const nextY = Math.min(memo.startY + memo.speedStep, memo.targetY);

      Body.setPosition(memo.body, {
        x: memo.x,
        y: nextY,
      });
    }

    const p = memo.body.position;

    if (memo === routine.activeMemo && p.y >= memo.targetY - 0.1) {
      const breakQueue = [...routine.failedMemos, memo].sort(
        (a, b) => b.body.position.y - a.body.position.y,
      );

      routine.failedMemos = [];
      routine.pendingBreakMemos = breakQueue;

      // 가장 아래에 있는 첫 번째 메모의 위치를 공통 파편화 위치로 설정
      routine.breakTargetY = breakQueue[0].body.position.y;
      routine.nextSpawnAt = Infinity;

      startNextBreakMemo(routine);
      saveState();
    }
  }
}

function updateFragments() {
  for (const fragment of [...fragments]) {
    fragment.life--;

    if (fragment.life <= 0) {
      Composite.remove(engine.world, fragment.body);
      fragments = fragments.filter((f) => f !== fragment);

      const routine = fragment.routine;

      if (
        routine &&
        routine.waitingForFragments &&
        !fragments.some((f) => f.routine === routine)
      ) {
        routine.waitingForFragments = false;

        if (routine.pendingBreakMemos && routine.pendingBreakMemos.length > 0) {
          startNextBreakMemo(routine);
        } else if (routine.remaining > 0) {
          routine.activeMemo = null;
          routine.nextSpawnAt = millis();
          spawnMemo(routine);
        } else {
          archiveFailedMemos(routine);
        }

        saveState();
      }
    }
  }
}

function drawMemos() {
  // 먼저 모든 메모의 확대 비율을 갱신
  for (const memo of memos) {
    if (memo.scaleFactor === undefined) {
      memo.scaleFactor = 1;
    }

    const isSelected = memo === selectedMemo;
    const hasInput = memo.entered.length > 0;
    const isFocused =
      isSelected && (hasInput || millis() - selectedMemoAt < 10000);

    const targetScale = isFocused ? 1.2 : 1;

    memo.scaleFactor += (targetScale - memo.scaleFactor) * 0.12;
  }

  const displayPositions = getMemoDisplayPositions();

  for (const memo of memos) {
    if (memo.hidden) continue;
    const p = {
      x: memo.body.position.x,
      y: displayPositions.get(memo),
    };

    const isSelected = memo === selectedMemo;
    const scaleFactor = memo.scaleFactor;

    let t = map(p.y, -boxH / 2, breakLine - boxH / 2, 0, 1);
    t = constrain(t, 0, 1);

    let redT = constrain(map(t, 0.5, 1, 0, 1), 0, 1);
    redT *= redT;

    // 세로 선은 확대하지 않고 메모 윗부분까지 연결
    const lineEndY = p.y - (boxH * scaleFactor) / 2;

    if (lineEndY > memoStartLine) {
      stroke(lerpColor(color("#F2E8DC"), color("#E21E42"), redT));
      strokeWeight(2);
      line(p.x, memoStartLine, p.x, lineEndY);
    }

    // 메모 상자와 내부 요소만 확대
    push();
    translate(p.x, p.y);
    scale(scaleFactor);
    rectMode(CENTER);

    stroke(isSelected ? 35 : 100);
    strokeWeight(isSelected ? 2.5 : 1);

    const memoColor = lerpColor(color("#F2E8DC"), color("#E21E42"), redT);

    fill(memoColor);
    rect(0, 0, boxW, boxH, 5);

    noStroke();

    fill(redT > 0.45 ? "#FFF4E8" : "#231719");
    textAlign(CENTER, CENTER);
    textSize(14);
    text(memo.txt, 0, -boxH / 2 + 23, boxW - 30, 30);

    fill(redT > 0.45 ? "#FFF4E8" : "#231719");
    textSize(40);
    text(memo.pattern, 0, 17);

    fill(90);
    textAlign(RIGHT, CENTER);
    textSize(10);
    text(
      `${memo.routineNumber}/${memo.routineTotal}`,
      boxW / 2 - 10,
      boxH / 2 - 10,
    );

    if (isSelected) {
      noFill();
      stroke(50, 120, 200);
      strokeWeight(2);
      rect(0, 0, boxW + 8, boxH + 8, 7);
    }

    pop();
  }
}

function getMemoDisplayPositions() {
  const positions = new Map();
  const lanes = new Map();

  // 같은 세로줄의 메모끼리 묶기
  for (const memo of memos) {
    if (memo.hidden) continue;

    if (!lanes.has(memo.x)) lanes.set(memo.x, []);
    lanes.get(memo.x).push(memo);
  }

  for (const lane of lanes.values()) {
    lane.sort((a, b) => a.body.position.y - b.body.position.y);

    // 우선 각 메모의 기본 위치 설정
    for (const memo of lane) {
      const scale = memo.scaleFactor ?? 1;
      const minY = memoStartLine + (boxH * scale) / 2 + 8;

      positions.set(memo, Math.max(memo.body.position.y, minY));
    }

    // 위에서부터 카드 사이의 간격 확보
    for (let i = 1; i < lane.length; i++) {
      const upper = lane[i - 1];
      const lower = lane[i];

      const upperScale = upper.scaleFactor ?? 1;
      const lowerScale = lower.scaleFactor ?? 1;

      const minY =
        positions.get(upper) +
        (boxH * upperScale) / 2 +
        (boxH * lowerScale) / 2 +
        STACK_GAP;

      positions.set(lower, Math.max(positions.get(lower), minY));
    }

    // 선택된 메모가 있으면 선택 카드가 위쪽 카드에 가리지 않도록 조정
    const selectedIndex = lane.findIndex((memo) => memo === selectedMemo);

    if (selectedIndex > 0) {
      const selected = lane[selectedIndex];
      const selectedScale = selected.scaleFactor ?? 1;

      for (let i = selectedIndex - 1; i >= 0; i--) {
        const upper = lane[i];
        const upperScale = upper.scaleFactor ?? 1;

        const maxY =
          positions.get(selected) -
          (boxH * selectedScale) / 2 -
          (boxH * upperScale) / 2 -
          STACK_GAP;

        positions.set(upper, Math.min(positions.get(upper), maxY));
      }
    }
  }

  // 파편화 기준선을 넘어가는 메모 위치 제한
  for (const lane of lanes.values()) {
    const visibleLane = lane.filter((memo) => !memo.hidden);

    for (let i = visibleLane.length - 1; i >= 0; i--) {
      const memo = visibleLane[i];
      const scale = memo.scaleFactor ?? 1;
      const maxY = breakLine - (boxH * scale) / 2;

      positions.set(memo, Math.min(positions.get(memo), maxY));
    }
  }

  return positions;
}

function drawFragments() {
  noStroke();

  for (const fragment of fragments) {
    const p = fragment.body.position;
    const alpha = map(fragment.life, 0, 55, 0, 220);
    const c = fragment.color;

    fill(c[0], c[1], c[2], alpha);
    push();
    translate(p.x, p.y);
    rotate(fragment.body.angle);
    rect(0, 0, fragment.size, fragment.size, 2);
    pop();
  }
}

function drawFloorArea() {
  // 터치 입력 영역
  noStroke();
  fill("#1f2022");
  rectMode(CORNER);
  rect(0, touchZoneTop, width, height - touchZoneTop);

  // 영역의 위쪽 경계
  stroke("#697585");
  strokeWeight(1.5);
  line(0, touchZoneTop, width, touchZoneTop);

  noStroke();
  fill("#F2E8DC");
  textAlign(CENTER, CENTER);
  textSize(12);

  if (selectedMemo) {
    text(
      "아래 영역을 짧게 또는 길게 눌러 패턴을 입력하세요",
      width / 2,
      height - 25,
    );
  } else {
    text(
      "메모를 선택한 뒤 아래 영역을 눌러 패턴을 입력하세요",
      width / 2,
      height - 25,
    );
  }
}

function createFloorFragments() {
  floorFragments = [];

  const spacing = 24;
  const columns = Math.ceil(width / spacing);

  for (let i = 0; i < columns; i++) {
    const x = i * spacing;
    const ridgeHeight =
      10 +
      (Math.sin(i * 0.075 + 1.2) + 1) * 22 +
      (Math.sin(i * 0.19 + 2.4) + 1) * 13 +
      (Math.sin(i * 0.31 + 0.7) + 1) * 7;

    const layers = Math.ceil(ridgeHeight / 22);

    for (let layer = 0; layer < layers; layer++) {
      const seed = i * 37 + layer * 19;
      const size = 12 + ((seed * 17) % 49);
      const offsetX = ((seed * 7) % 13) - 6;
      const offsetY = ((seed * 11) % 9) - 4;
      const angle = ((((seed * 23) % 91) - 45) * Math.PI) / 180;

      floorFragments.push({
        x: x + offsetX,
        y: touchZoneTop - size / 2 - layer * 18 + offsetY,
        size,
        angle,
        color: [
          [242, 232, 220],
          [248, 240, 228],
          [235, 224, 209],
          [228, 216, 201],
          [245, 235, 222],
          [238, 229, 216],
        ][seed % 6],
      });
    }
  }
}

function randomIvory() {
  const palette = [
    [242, 232, 220], // 기본 아이보리
    [248, 240, 228], // 밝은 아이보리
    [235, 224, 209], // 따뜻한 베이지
    [228, 216, 201], // 조금 어두운 베이지
    [245, 235, 222], // 부드러운 크림
    [238, 229, 216], // 중간 톤
  ];

  return random(palette);
}

function randomMutedRed() {
  const palette = [
    [220, 145, 150],
    [205, 125, 135],
    [190, 110, 120],
    [225, 160, 160],
    [175, 105, 115],
    [215, 135, 145],
  ];

  return random(palette);
}

function drawFragmentPile() {
  rectMode(CENTER);
  noStroke();

  for (const piece of floorFragments) {
    const c = piece.color;

    push();
    translate(piece.x, piece.y);
    rotate(piece.angle);
    fill(c[0], c[1], c[2]);
    rect(0, 0, piece.size, piece.size);

    pop();
  }

  rectMode(CORNER);
}

function drawStatus() {
  noStroke();
  fill(60);
  textAlign(LEFT, CENTER);
  textSize(12);
  text(`메모 ${memos.length}/${MAX_MEMOS}`, 20, 65);
}

function drawTouchMarks() {
  noStroke();

  for (const mark of touchMarks) {
    fill(mark.color[0], mark.color[1], mark.color[2]);

    if (mark.type === ".") {
      // 점
      circle(mark.x, mark.y, 18);
    } else {
      // 선
      rectMode(CENTER);
      rect(mark.x, mark.y, 38, 12, 2);
    }
  }
}

function addTouchMark(x, y, type) {
  const markColors = [
    [255, 95, 105], // 코랄 레드
    [100, 190, 255], // 스카이 블루
    [170, 130, 255], // 라벤더
    [255, 190, 80], // 옐로 오렌지
    [100, 210, 160], // 민트 그린
  ];

  touchMarks.push({
    type,
    color: markColors[touchMarks.length % markColors.length],
  });

  const dotWidth = 18;
  const dashWidth = 38;
  const gap = 12;

  const widths = touchMarks.map((mark) =>
    mark.type === "." ? dotWidth : dashWidth,
  );

  const totalWidth =
    widths.reduce((sum, w) => sum + w, 0) +
    gap * Math.max(0, widths.length - 1);

  let currentX = width / 2 - totalWidth / 2;
  const markY = touchZoneTop + 55;

  touchMarks.forEach((mark, i) => {
    mark.x = currentX + widths[i] / 2;
    mark.y = markY;
    currentX += widths[i] + gap;
  });
}

function mousePressed() {
  // 1. 홈 화면의 시작 버튼
  if (screenMode === "home") {
    const buttonX = width / 2;

    if (
      mouseX >= buttonX - homeButtonW / 2 &&
      mouseX <= buttonX + homeButtonW / 2 &&
      mouseY >= homeButtonY - homeButtonH / 2 &&
      mouseY <= homeButtonY + homeButtonH / 2
    ) {
      screenMode = "routine";
      updateTopControlsVisibility();
    }

    return false;
  }

  // 2. 상단 화면 전환 버튼
  const homeX = width - NAV_BUTTON_W * 3 - NAV_GAP * 2 - 16;
  const memoX = homeX + NAV_BUTTON_W + NAV_GAP;
  const archiveX = memoX + NAV_BUTTON_W + NAV_GAP;
  const navY = 20;

  if (mouseY >= navY && mouseY <= navY + NAV_BUTTON_H) {
    if (mouseX >= homeX && mouseX <= homeX + NAV_BUTTON_W) {
      screenMode = "home";
      updateTopControlsVisibility();
      saveState();
      return false;
    }

    if (mouseX >= memoX && mouseX <= memoX + NAV_BUTTON_W) {
      screenMode = "routine";
      updateTopControlsVisibility();
      saveState();
      return false;
    }

    if (mouseX >= archiveX && mouseX <= archiveX + NAV_BUTTON_W) {
      screenMode = "archive";
      updateTopControlsVisibility();
      saveState();
      return false;
    }
  }

  // 3. 보관함 화면: 보관된 메모 선택
  if (screenMode === "archive") {
    const cardW = 180;
    const cardH = 100;
    const scaleFactor = 1.2;
    const gapX = 40;
    const gapY = 36;

    const spacingX = cardW * scaleFactor + gapX;
    const spacingY = cardH * scaleFactor + gapY;

    const columns = max(1, floor((width - 48 + gapX) / spacingX));

    const totalW = columns * cardW * scaleFactor + (columns - 1) * gapX;

    const startX = max(24, (width - totalW) / 2);
    const startY = 110;

    for (let i = archivedMemos.length - 1; i >= 0; i--) {
      const col = i % columns;
      const row = floor(i / columns);

      const x = startX + col * spacingX;
      const y = startY + row * spacingY;

      const centerX = x + cardW / 2;
      const centerY = y + cardH / 2;

      if (
        mouseX >= centerX - (cardW * scaleFactor) / 2 - 4 &&
        mouseX <= centerX + (cardW * scaleFactor) / 2 + 4 &&
        mouseY >= centerY - (cardH * scaleFactor) / 2 - 4 &&
        mouseY <= centerY + (cardH * scaleFactor) / 2 + 4
      ) {
        selectedArchivedMemo = archivedMemos[i];
        enteredPattern = "";
        touchMarks = [];
        return false;
      }
    }

    // 보관함의 아래쪽 입력 영역
    if (mouseY >= height - TOUCH_ZONE_HEIGHT && selectedArchivedMemo) {
      isTouchingFloor = true;
      touchStart = millis();
    }

    return false;
  }

  // 4. 일반 메모 화면: 메모 선택 및 확대
  const displayPositions = getMemoDisplayPositions();

  for (let i = memos.length - 1; i >= 0; i--) {
    const memo = memos[i];

    if (memo.hidden) continue;

    const scaleFactor = memo.scaleFactor ?? 1;
    const x = memo.body.position.x;
    const y = displayPositions.get(memo);

    if (y === undefined) continue;

    if (
      mouseX >= x - (boxW * scaleFactor) / 2 - 4 &&
      mouseX <= x + (boxW * scaleFactor) / 2 + 4 &&
      mouseY >= y - (boxH * scaleFactor) / 2 - 4 &&
      mouseY <= y + (boxH * scaleFactor) / 2 + 4
    ) {
      selectedMemo = memo;
      selectedMemoAt = millis();
      enteredPattern = "";
      memo.entered = "";
      touchMarks = [];
      return false;
    }
  }

  // 5. 일반 메모 화면의 아래쪽 입력 영역
  if (mouseY >= touchZoneTop && selectedMemo) {
    isTouchingFloor = true;
    touchStart = millis();
  }

  return false;
}

function mouseReleased() {
  if (patternCompletedAt > 0) {
    isTouchingFloor = false;
    return false;
  }
  if (screenMode === "archive") {
    if (!isTouchingFloor || !selectedArchivedMemo) {
      isTouchingFloor = false;
      return false;
    }

    const duration = millis() - touchStart;
    const type = duration < 350 ? "." : "-";

    addTouchMark(mouseX, mouseY, type);

    enteredPattern += type;
    lastPatternInputAt = millis();

    const normalizedPattern = selectedArchivedMemo.pattern.replaceAll("·", ".");

    if (!normalizedPattern.startsWith(enteredPattern)) {
      enteredPattern = "";
      touchMarks = [];
    } else if (enteredPattern === normalizedPattern) {
      patternCompletedAt = millis();
      completedPatternMemo = selectedArchivedMemo;
      completedPatternScreen = "archive";
    }

    isTouchingFloor = false;
    return false;
  }

  if (!isTouchingFloor || !selectedMemo) {
    isTouchingFloor = false;
    return false;
  }

  const duration = millis() - touchStart;
  const type = duration < 350 ? "." : "-";

  addTouchMark(mouseX, mouseY, type);

  enteredPattern += type;
  selectedMemo.entered = enteredPattern;
  lastPatternInputAt = millis();

  const normalizedPattern = selectedMemo.pattern.replaceAll("·", ".");
  if (!normalizedPattern.startsWith(enteredPattern)) {
    enteredPattern = "";
    selectedMemo.entered = "";
    touchMarks = [];
  } else if (enteredPattern === normalizedPattern) {
    patternCompletedAt = millis();
    completedPatternMemo = selectedMemo;
    completedPatternScreen = "routine";
  }

  isTouchingFloor = false;
  saveState();

  return false;
}

function touchStarted() {
  return mousePressed();
}

function touchEnded() {
  return mouseReleased();
}

function saveState() {
  try {
    const data = {
      memos: memos.map((memo) => ({
        txt: memo.txt,
        x: memo.x,
        y: memo.body.position.y,
        targetY: memo.targetY,
        stackIndex: memo.stackIndex,
        pattern: memo.pattern,
        entered: memo.entered,
        speedStep: memo.speedStep,
        routineNumber: memo.routineNumber,
        routineTotal: memo.routineTotal,
      })),
      archivedMemos: archivedMemos.map((memo) => ({
        txt: memo.txt,
        pattern: memo.pattern,
        routineNumber: memo.routineNumber,
        routineTotal: memo.routineTotal,
      })),
      routines: routines.map((routine) => ({
        txt: routine.txt,
        total: routine.total,
        remaining: routine.remaining,
        created: routine.created,
        nextSpawnDelay: Math.max(0, routine.nextSpawnAt - millis()),
      })),
      nextPattern,
      memoPatterns,
      memoLanes,
      nextLane,
    };

    localStorage.setItem("dailyRoutineMemos", JSON.stringify(data));
  } catch (error) {
    console.warn("메모 저장에 실패했습니다.", error);
  }
}

function loadMemos() {
  try {
    const saved = localStorage.getItem("dailyRoutineMemos");
    if (!saved) return;
    const data = JSON.parse(saved);
    if (!data) return;

    archivedMemos = Array.isArray(data.archivedMemos)
      ? data.archivedMemos.map((item) => ({
          txt: String(item.txt ?? ""),
          pattern: String(item.pattern ?? PATTERNS[0]),
          routineNumber: Number(item.routineNumber ?? 1),
          routineTotal: Number(item.routineTotal ?? 1),
        }))
      : [];

    if (!Array.isArray(data.memos)) return;

    memoPatterns = data.memoPatterns || {};
    memoLanes = data.memoLanes || {};
    memos = [];
    fragments = [];
    routines = [];

    for (const item of data.memos.slice(0, MAX_MEMOS)) {
      const body = Bodies.rectangle(
        item.x ?? width / 2,
        item.y ?? 100,
        boxW,
        boxH,
        { isStatic: true },
      );

      const startY = Number(item.y ?? 100);
      const targetY = Number(item.targetY ?? breakLine - boxH / 2);

      const totalSteps = Math.max(
        1,
        Math.ceil(Math.max(0, targetY - startY) / STEP_SIZE),
      );

      const dropDuration =
        ROUTINE_DURATION_MS / Math.max(1, Number(item.routineTotal ?? 1));

      const stepInterval = Math.max(1, dropDuration / totalSteps);

      const memo = {
        txt: String(item.txt ?? ""),
        body,
        x: Number(item.x ?? width / 2),
        pattern: String(item.pattern ?? PATTERNS[0]),
        entered: String(item.entered ?? ""),
        speedStep: 0,
        startY,
        targetY,
        nextStepAt: millis() + stepInterval,
        stepInterval,
        totalSteps,
        broken: false,
        routineNumber: Number(item.routineNumber ?? 1),
        routineTotal: Number(item.routineTotal ?? 1),
        routine: null,
        stackIndex: Number(item.stackIndex ?? 0),
      };

      if (memoPatterns[memo.txt] === undefined) {
        memoPatterns[memo.txt] = memo.pattern;
      }

      if (memoLanes[memo.txt] === undefined) {
        memoLanes[memo.txt] = memo.x;
      }

      memos.push(memo);
      Composite.add(engine.world, body);
    }

    if (Array.isArray(data.routines)) {
      routines = data.routines
        .filter(
          (r) =>
            Number(r.remaining) > 0 ||
            data.memos.some((memo) => memo.txt === r.txt),
        )
        .map((r) => ({
          txt: String(r.txt ?? ""),
          total: Number(r.total ?? 1),
          remaining: Number(r.remaining ?? 0),
          created: Number(r.created ?? 0),
          nextSpawnAt: millis() + Math.max(0, Number(r.nextSpawnDelay ?? 0)),
          activeMemo: null,
          failedMemos: [],
          laneX: getLaneXForText(String(r.txt ?? "")),
          waitingForFragments: false,
        }));

      for (const routine of routines) {
        const relatedMemos = memos
          .filter((memo) => memo.txt === routine.txt)
          .sort((a, b) => a.routineNumber - b.routineNumber);

        if (relatedMemos.length === 0) continue;

        // 가장 마지막 회차만 현재 진행 중인 메모로 연결
        const activeMemo = relatedMemos[relatedMemos.length - 1];

        for (const memo of relatedMemos) {
          memo.routine = routine;

          if (memo === activeMemo) {
            routine.activeMemo = memo;
          } else {
            routine.failedMemos.push(memo);
          }
        }
      }
    }

    nextPattern = Number(data.nextPattern ?? 0);
    nextLane = Number(data.nextLane ?? 0);
  } catch (error) {
    console.warn("메모 불러오기에 실패했습니다.", error);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  updateLayout();
  createFloorFragments();
  layoutTopControls();

  for (const memo of memos) {
    const x = constrain(memo.body.position.x, boxW / 2, width - boxW / 2);

    memo.x = x;

    Body.setPosition(memo.body, {
      x,
      y: memo.body.position.y,
    });
  }

  memoLanes = {};

  for (const memo of memos) {
    if (memoLanes[memo.txt] === undefined) {
      memoLanes[memo.txt] = memo.x;
    }
  }
}

/////////////

function drawHomeScreen() {
  background("#fafaf8");

  const centerX = width / 2;
  const scale = Math.min(width / 700, height / 600, 1);

  const titleY = height * 0.2;
  const subtitleY = titleY + 32 * scale;
  const guideY = height * 0.48;
  const buttonY = height * 0.78;

  noStroke();
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  fill("#231719");
  textSize(Math.max(22, 34 * scale));
  text("ROUTINE", centerX, titleY);

  textStyle(NORMAL);
  fill("#77716D");
  textSize(Math.max(12, 15 * scale));
  text("건강한 루틴을 만드는 메모", centerX, subtitleY);

  const guideText =
    "습관으로 만들고 싶은 행동을 메모로 입력합니다.\n" +
    "1. 메모가 바닥에 닿기 전에 행동을 실천하고 메모를 삭제합니다.\n" +
    "2. 메모를 삭제하려면 표시된 패턴을 똑같이 터치해야 합니다.";

  fill("#231719");
  textSize(Math.max(10, 13 * scale));
  textLeading(Math.max(16, 20 * scale));

  const guideW = Math.max(0, width - 32);
  const guideH = Math.min(height * 0.25, 100);

  text(guideText, 16, guideY - guideH / 2, guideW, guideH);

  const buttonW = Math.min(180, width - 40);
  const buttonH = 54;

  rectMode(CENTER);
  noStroke();
  fill("#231719");
  rect(centerX, buttonY, buttonW, buttonH, 5);

  fill("#FFFFFF");
  textAlign(CENTER, CENTER);
  textSize(16);
  text("시작", centerX, buttonY);

  homeButtonY = buttonY;
  homeButtonW = buttonW;
  homeButtonH = buttonH;

  rectMode(CORNER);
}

function drawNavigationButtons() {
  const homeX = width - NAV_BUTTON_W * 3 - NAV_GAP * 2 - 16;
  const memoX = homeX + NAV_BUTTON_W + NAV_GAP;
  const archiveX = memoX + NAV_BUTTON_W + NAV_GAP;
  const y = 20;

  rectMode(CORNER);
  textAlign(CENTER, CENTER);
  textSize(13);

  stroke("#B7B0AA");
  strokeWeight(1);
  fill("#FFFFFF");

  rect(homeX, y, NAV_BUTTON_W, NAV_BUTTON_H, 5);
  rect(memoX, y, NAV_BUTTON_W, NAV_BUTTON_H, 5);
  rect(archiveX, y, NAV_BUTTON_W, NAV_BUTTON_H, 5);

  noStroke();
  fill("#231719");

  text("홈", homeX + NAV_BUTTON_W / 2, y + NAV_BUTTON_H / 2);
  text("메모", memoX + NAV_BUTTON_W / 2, y + NAV_BUTTON_H / 2);
  text("보관함", archiveX + NAV_BUTTON_W / 2, y + NAV_BUTTON_H / 2);
}

function drawArchiveScreen() {
  background("#fafaf8");

  const cardW = 180;
  const cardH = 100;
  const scaleFactor = 1.2;
  const gapX = 40;
  const gapY = 36;

  const spacingX = cardW * scaleFactor + gapX;
  const spacingY = cardH * scaleFactor + gapY;

  const columns = Math.max(1, Math.floor((width - 48 + gapX) / spacingX));
  const totalW = (columns - 1) * spacingX + cardW;
  const startX = (width - totalW) / 2;
  const startY = 110;

  for (let i = 0; i < archivedMemos.length; i++) {
    const memo = archivedMemos[i];
    const col = i % columns;
    const row = Math.floor(i / columns);

    const x = startX + col * spacingX;
    const y = startY + row * spacingY;

    if (memo.scaleFactor === undefined) {
      memo.scaleFactor = 1;
    }

    const targetScale = selectedArchivedMemo === memo ? 1.2 : 1;

    memo.scaleFactor += (targetScale - memo.scaleFactor) * 0.18;

    push();
    translate(x + cardW / 2, y + cardH / 2);
    scale(memo.scaleFactor);
    rectMode(CENTER);

    fill(selectedArchivedMemo === memo ? "#E7D8CB" : "#F2E8DC");
    stroke("#8B8179");
    strokeWeight(1);
    rect(0, 0, cardW, cardH, 5);

    noStroke();
    fill("#231719");
    textAlign(CENTER, CENTER);
    textSize(13);
    text(memo.txt, 0, -35, cardW - 20, 30);

    textSize(22);
    text(memo.pattern, 0, 12);

    if (selectedArchivedMemo === memo) {
      noFill();
      stroke(50, 120, 200);
      strokeWeight(2);
      rect(0, 0, cardW + 8, cardH + 8, 7);
    }

    pop();
  }

  drawArchiveInputArea();

  // 버튼 영역과 메모 영역을 구분하는 빨간 선
  stroke(190, 20, 35);
  strokeWeight(1.5);
  line(0, 75, width, 75);
  drawNavigationButtons();
}

function drawArchiveInputArea() {
  const zoneH = TOUCH_ZONE_HEIGHT;
  const y = height - zoneH;

  noStroke();
  fill("#1f2022");
  rectMode(CORNER);
  rect(0, y, width, zoneH);

  // 입력 영역 위쪽 경계
  stroke("#697585");
  strokeWeight(1.5);
  line(0, y, width, y);

  // 루틴 페이지와 동일한 색상의 패턴 도형
  drawTouchMarks();

  noStroke();
  fill("#F2E8DC");
  textAlign(CENTER, CENTER);
  textSize(12);

  if (selectedArchivedMemo) {
    text(
      "아래 영역을 짧게 또는 길게 눌러 패턴을 입력하세요",
      width / 2,
      height - 22,
    );
  } else {
    text(
      "메모를 선택한 뒤 아래 영역을 눌러 패턴을 입력하세요",
      width / 2,
      height - 22,
    );
  }
}
