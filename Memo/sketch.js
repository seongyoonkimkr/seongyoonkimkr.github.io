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
let isTouchingFloor = false;
let touchStart = 0;
let enteredPattern = "";

let nextPattern = 0;
let nextLane = 0;
let memoLanes = {};
let memoPatterns = {};

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
const STACK_GAP = 8;
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
  countInput = createInput("3", "number");
  countInput.attribute("min", "1");
  countInput.attribute("max", "30");
  countInput.attribute("step", "1");
  setupInput(countInput, 250, 65);

  // 루틴 추가 버튼
  addButton = createButton("루틴 추가");
  addButton.position(330, 20);
  addButton.elt.style.position = "fixed";
  addButton.elt.style.zIndex = "10000";
  addButton.elt.style.pointerEvents = "auto";
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
}

function layoutTopControls() {
  const groupWidth = 395;
  const left = max(10, (width - groupWidth) / 2);

  taskInput.position(left, 20);
  taskInput.size(220, 28);

  countInput.position(left + 230, 20);
  countInput.size(65, 28);

  addButton.position(left + 305, 20);
  addButton.size(90, 28);
}

function updateLayout() {
  memoStartLine = 75;
  breakLine = height - BREAK_LINE_OFFSET;
  touchZoneTop = height - TOUCH_ZONE_HEIGHT;
}

function addRoutine() {
  const txt = taskInput.value().trim();
  const count = floor(Number(countInput.value()));

  if (!txt || !Number.isFinite(count) || count < 1) return;

  const pendingCount = routines.reduce((sum, r) => sum + r.remaining, 0);

  if (memos.length + pendingCount + count > MAX_MEMOS) {
    return;
  }

  routines.push({
    txt,
    total: min(count, MAX_MEMOS),
    remaining: min(count, MAX_MEMOS),
    nextSpawnAt: millis(),
    created: 0,
    activeMemo: null,
    failedMemos: [],
    laneX: getLaneXForText(txt),
  });

  taskInput.value("");
  saveState();

  taskInput.value("");
  saveState();
}

function getLaneX() {
  const spacing = boxW + 30;
  const laneCount = max(
    1,
    floor((width - 2 * SIDE_MARGIN - boxW) / spacing) + 1,
  );
  const laneIndex = nextLane % laneCount;
  nextLane++;
  return SIDE_MARGIN + boxW / 2 + laneIndex * spacing;
}

function getLaneXForText(txt) {
  if (memoLanes[txt] === undefined) {
    memoLanes[txt] = getLaneX();
  }
  return memoLanes[txt];
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
  if (routine.activeMemo) return;

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
    });

    Composite.add(engine.world, body);
  }
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

function draw() {
  background(246, 243, 235);

  Engine.update(engine);

  updateLayout();
  updateRoutines();
  updateMemos();
  updateFragments();
  drawMemoStartLine();

  drawMemos();
  drawFragments();
  drawFragmentPile();
  drawFloorArea();
  drawTouchMarks();
  drawStatus();

  if (frameCount % 60 === 0) {
    saveState();
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
      now >= routine.nextSpawnAt
    ) {
      spawnMemo(routine);
    }
  }
  routines = routines.filter(
    (routine) => routine.remaining > 0 || routine.activeMemo,
  );
}

function updateMemos() {
  const now = millis();

  for (const memo of [...memos]) {
    const routine = memo.routine;

    if (!routine || memo.broken) continue;

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

    // 현재 새 메모가 목표 위치에 도달한 경우에만 실패 처리
    if (memo === routine.activeMemo && p.y >= memo.targetY - 0.1) {
      memo.broken = true;

      createFragments(memo);

      // 마지막 회차가 실패하면 이전 미완료 메모를 정리
      if (routine.remaining <= 0) {
        for (const oldMemo of [...routine.failedMemos]) {
          removeMemo(oldMemo, false);
        }

        routine.failedMemos = [];

        // 마지막 메모는 삭제하지 않고 빨간 메모로 남김
        routine.activeMemo = memo;
        saveState();
      } else {
        // 다음 회차가 남아 있으면 미완료 메모로 보관
        routine.activeMemo = null;
        routine.failedMemos.push(memo);
        routine.nextSpawnAt = now;
      }
    }
  }
}

function updateFragments() {
  for (const fragment of [...fragments]) {
    fragment.life--;

    if (fragment.life <= 0) {
      Composite.remove(engine.world, fragment.body);
      fragments = fragments.filter((f) => f !== fragment);
    }
  }
}

function drawMemos() {
  for (const memo of memos) {
    const p = memo.body.position;
    const isSelected = memo === selectedMemo;

    push();
    rectMode(CENTER);

    // 메모 상자
    stroke(isSelected ? 35 : 100);
    strokeWeight(isSelected ? 2.5 : 1);
    // 메모가 내려갈수록 크림색에서 짙은 적색으로 변화
    let t = map(p.y, -boxH / 2, breakLine - boxH / 2, 0, 1);
    t = constrain(t, 0, 1);

    // 절반 지점까지 아이보리색을 유지하고,
    // 그 이후부터 선명한 빨간색으로 변화
    let redT = map(t, 0.5, 1, 0, 1);
    redT = constrain(redT, 0, 1);
    redT = redT * redT;

    // 줄도 메모와 동일하게 아래로 갈수록 빨간색으로 변화
    stroke(lerpColor(color("#F2E8DC"), color("#E21E42"), redT));
    strokeWeight(2);
    line(p.x, memoStartLine, p.x, p.y - boxH / 2);

    let memoColor = lerpColor(color("#F2E8DC"), color("#E21E42"), redT);

    fill(memoColor);
    rect(p.x, p.y, boxW, boxH, 5);

    noStroke();

    // 1. 루틴 텍스트: 상단 중앙
    fill(redT > 0.45 ? "#FFF4E8" : "#231719");
    textAlign(CENTER, CENTER);
    textSize(14);
    text(memo.txt, p.x, p.y - boxH / 2 + 23, boxW - 30, 30);

    // 2. 패턴 코드: 중앙 하단
    fill(redT > 0.45 ? "#FFF4E8" : "#231719");
    textAlign(CENTER, CENTER);
    textSize(40);
    text(memo.pattern, p.x, p.y + 17);

    // 3. 현재 루틴 진행 횟수: 우측 하단
    fill(90);
    textAlign(RIGHT, CENTER);
    textSize(10);
    text(
      `${memo.routineNumber}/${memo.routineTotal}`,
      p.x + boxW / 2 - 10,
      p.y + boxH / 2 - 10,
    );

    // 선택된 메모 테두리
    if (isSelected) {
      noFill();
      stroke(50, 120, 200);
      strokeWeight(2);
      rect(p.x, p.y, boxW + 8, boxH + 8, 7);
    }

    pop();
  }
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
      `선택된 메모의 패턴을 입력하세요 ${enteredPattern}`,
      width / 2,
      height - 25,
    );
  } else {
    text(
      "메모를 선택한 뒤 바닥 영역을 짧게 또는 길게 누르세요",
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
  touchMarks.push({
    type,
    color: [226, 30, 66],
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
  // 메모를 위에서부터 역순으로 검사합니다.
  for (let i = memos.length - 1; i >= 0; i--) {
    const memo = memos[i];
    const p = memo.body.position;

    if (
      mouseX >= p.x - boxW / 2 &&
      mouseX <= p.x + boxW / 2 &&
      mouseY >= p.y - boxH / 2 &&
      mouseY <= p.y + boxH / 2
    ) {
      selectedMemo = memo;
      enteredPattern = "";
      memo.entered = "";
      touchMarks = [];
      return;
    }
  }

  // 바닥 영역을 누르면 패턴 입력을 시작합니다.
  if (mouseY >= touchZoneTop && selectedMemo) {
    isTouchingFloor = true;
    touchStart = millis();
  }
}

function mouseReleased() {
  if (!isTouchingFloor || !selectedMemo) {
    isTouchingFloor = false;
    return false;
  }

  const duration = millis() - touchStart;
  const type = duration < 350 ? "." : "-";

  addTouchMark(mouseX, mouseY, type);

  enteredPattern += type;
  selectedMemo.entered = enteredPattern;

  const normalizedPattern = selectedMemo.pattern.replaceAll("·", ".");
  if (!normalizedPattern.startsWith(enteredPattern)) {
    enteredPattern = "";
    selectedMemo.entered = "";
    touchMarks = [];
  } else if (enteredPattern === normalizedPattern) {
    removeMemo(selectedMemo);
    touchMarks = [];
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
      routines: routines.map((routine) => ({
        txt: routine.txt,
        total: routine.total,
        remaining: routine.remaining,
        created: routine.created,
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
    if (!data || !Array.isArray(data.memos)) return;

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
        .filter((r) => Number(r.remaining) > 0)
        .map((r) => ({
          txt: String(r.txt ?? ""),
          total: Number(r.total ?? 1),
          remaining: Number(r.remaining ?? 0),
          created: Number(r.created ?? 0),
          nextSpawnAt: millis(),
          activeMemo: null,
          failedMemos: [],
          laneX: getLaneXForText(String(r.txt ?? "")),
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
}
