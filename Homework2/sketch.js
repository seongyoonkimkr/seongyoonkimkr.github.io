const Engine = Matter.Engine;
const Bodies = Matter.Bodies;
const Composite = Matter.Composite;
const Body = Matter.Body;

let engine;

let scene = 1;

let dragging = false;
let dragDistance = 0;
let lastDragX = 0;
let lastDragY = 0;
// 먼지
let dusts = [];
let dusts2 = [];
let dusts3 = [];

function setup() {
  createCanvas(windowWidth, windowHeight);

  rectMode(CENTER);

  engine = Engine.create();

  engine.gravity.x = 0;
  engine.gravity.y = 0;

  // 먼지
  for (let i = 0; i < 10; i++) {
    let x = random(100, width - 100);
    let y = random(100, height - 100);
    let size = random(8, 14);
    dusts.push(new Dust(x, y, size));
  }

  // 먼지2
  for (let i = 0; i < 13; i++) {
    let x = random(width * 0.25, width * 0.8);
    let y = random(height * 0.86, height * 0.9);
    let size = random(5, 10);
    dusts2.push(new Dust(x, y, size));
  }

  // 먼지3
  for (let i = 0; i < 24; i++) {
    let windowX = width * 0.67;
    let windowW = (width - 120) * 0.6;
    let x;
    let y;
    let valid = false;
    while (!valid) {
      x = random(windowX - windowW / 2 + 20, windowX + windowW / 2 - 20);
      y = height * 0.42 + 190 + random(-3, 3);
      valid = true;
      for (let d of dusts3) {
        let distance = dist(x, y, d.body.position.x, d.body.position.y);
        if (distance < 15) {
          valid = false;
          break;
        }
      }
    }
    let size = random(4, 8);
    dusts3.push(new Dust(x, y, size));
  }
}

function draw() {
  Engine.update(engine);

  if (scene == 1) {
    // 1단계
    background("#343118");
    drawDesk();
    for (let d of dusts) {
      d.display();
    }
  }

  if (scene == 2) {
    background("#eee9dc");
    drawSunlight();

    // 벽 안에서만 먼지가 보이도록 제한
    drawingContext.save();
    drawingContext.beginPath();
    drawingContext.rect(60, 60, width - 120, height - 120);
    drawingContext.clip();

    // 먼지
    for (let i = dusts2.length - 1; i >= 0; i--) {
      let d = dusts2[i];
      d.float();
      d.display();
    }

    drawingContext.restore();
  }

  if (scene == 3) {
    background("#2e2c2c");

    drawWindow();

    // 먼지
    for (let i = dusts3.length - 1; i >= 0; i--) {
      let d = dusts3[i];

      d.display();
    }
  }

  // 다음 화면 버튼
  drawNextButton();
}

function drawDesk() {
  noStroke();

  // 책상
  fill("#e2dacf");

  rect(width / 2, height / 2, width - 120, height - 120);

  // 책 1 - 아래에 깔린 책
  push();
  translate(width * 0.38, height * 0.52);
  rotate(-0.08);
  fill("#5e5252");
  rect(0, 0, 320, 420);
  pop();

  // 책 2 - 위에 포개진 책
  push();
  translate(width * 0.34, height * 0.47);
  rotate(0.04);
  fill("#fbf8f8");
  rect(0, 0, 280, 400);
  pop();

  // 책 위의 라벨
  push();
  translate(width * 0.34, height * 0.47);
  rotate(0.04);
  stroke("#a80b0b");
  fill("#d8d0c0");
  rect(0, 5, 80, 30);
  fill(70);

  textAlign(CENTER, CENTER);
  textSize(12);
  noStroke();

  text("DUST", 0, 5);
  pop();

  // //컵
  // fill(170, 160, 150);
  // ellipse(width * 0.8, height * 0.25, 100, 100);
}

function mousePressed() {
  // 01 버튼
  if (mouseX > width - 190 && mouseX < width - 150 && mouseY > height - 70) {
    scene = 1;
    return;
  }

  // 02 버튼
  if (mouseX > width - 140 && mouseX < width - 100 && mouseY > height - 70) {
    scene = 2;
    return;
  }

  // 03 버튼
  if (mouseX > width - 90 && mouseX < width - 50 && mouseY > height - 70) {
    scene = 3;
    return;
  }

  // 1단계에서만 먼지 삭제
  if (scene == 1) {
    for (let i = dusts.length - 1; i >= 0; i--) {
      let d = dusts[i];
      let distance = dist(mouseX, mouseY, d.body.position.x, d.body.position.y);

      if (distance < d.size * 2) {
        Composite.remove(engine.world, d.body);
        dusts.splice(i, 1);
        break;
      }
    }
  }

  // 2단계에서 한 번 터치하면 모든 먼지가 떠오름
  if (scene == 2) {
    for (let d of dusts2) {
      d.floating = true;
    }
  }

  // 3단계 드래그 시작
  if (scene == 3) {
    dragging = false;
    dragDistance = 0;

    lastDragX = mouseX;
    lastDragY = mouseY;

    return;
  }
}

function touchStarted() {
  // 01 버튼
  if (mouseX > width - 190 && mouseX < width - 150 && mouseY > height - 70) {
    scene = 1;
    return false;
  }

  // 02 버튼
  if (mouseX > width - 140 && mouseX < width - 100 && mouseY > height - 70) {
    scene = 2;
    return false;
  }

  // 03 버튼
  if (mouseX > width - 90 && mouseX < width - 50 && mouseY > height - 70) {
    scene = 3;
    return false;
  }

  // 1단계에서만 먼지 삭제
  if (scene == 1) {
    for (let i = dusts.length - 1; i >= 0; i--) {
      let d = dusts[i];
      let distance = dist(mouseX, mouseY, d.body.position.x, d.body.position.y);

      if (distance < d.size * 2) {
        Composite.remove(engine.world, d.body);
        dusts.splice(i, 1);
        break;
      }
    }
  }

  // 2단계에서 한 번 터치하면 모든 먼지가 떠오름
  if (scene == 2) {
    for (let d of dusts2) {
      d.floating = true;
    }
  }

  // 3단계에서 드래그해서 먼지가 이어진 후에 사라지게 함.
  if (scene == 3) {
    dragging = false;
    dragDistance = 0;

    lastDragX = mouseX;
    lastDragY = mouseY;

    return false;
  }
  return false;
}

function mouseDragged() {
  if (scene == 3) {
    let moveDistance = dist(lastDragX, lastDragY, mouseX, mouseY);
    dragDistance += moveDistance;
    if (dragDistance > 5) {
      dragging = true;
    }
    if (dragging) {
      collectDust(mouseX, mouseY);
    }
    lastDragX = mouseX;
    lastDragY = mouseY;
  }
}

function mouseReleased() {
  if (scene == 3) {
    dragging = false;
    dragDistance = 0;
  }
}

function touchMoved() {
  if (scene == 3) {
    let moveDistance = dist(lastDragX, lastDragY, mouseX, mouseY);
    dragDistance += moveDistance;
    if (dragDistance > 5) {
      dragging = true;
    }
    if (dragging) {
      collectDust(mouseX, mouseY);
    }
    lastDragX = mouseX;
    lastDragY = mouseY;
  }

  return false;
}

function touchEnded() {
  if (scene == 3) {
    dragging = false;
    dragDistance = 0;
  }
  return false;
}

function collectDust(x, y) {
  let collected = [];
  for (let d of dusts3) {
    let distance = dist(x, y, d.body.position.x, d.body.position.y);

    // 드래그 위치 주변의 먼지를 모음
    if (distance < 50) {
      collected.push(d);
    }
  }

  // 먼지를 드래그 위치로 이동
  for (let d of collected) {
    Body.setPosition(d.body, {
      x: x + random(-1.5, 1.5),
      y: y + random(-1.5, 1.5),
    });
  }

  // 4개 이상 모이면 삭제
  if (collected.length >= 4) {
    for (let d of collected) {
      Composite.remove(engine.world, d.body);
      let index = dusts3.indexOf(d);
      if (index !== -1) {
        dusts3.splice(index, 1);
      }
    }
  }
}

function drawSunlight() {
  noStroke();

  // 벽
  fill("#a69526");
  rect(width / 2, height / 2, width - 120, height - 120);

  // 창문틀
  fill("#d7d4ca");
  rect(width * 0.72, height * 0.35, 260, 300);

  // 햇빛이 벽 밖으로 나가지 않도록.
  drawingContext.save();
  drawingContext.beginPath();
  drawingContext.rect(60, 60, width - 120, height - 120);
  drawingContext.clip();

  // 햇빛
  let sunlightColor = color("#fefcbd");
  sunlightColor.setAlpha(80);

  fill(sunlightColor);
  beginShape();

  vertex(width * 0.72 - 130, height * 0.35 - 150);
  vertex(width * 0.72 + 130, height * 0.35 + 150);
  vertex(width * 0.62, height);
  vertex(width * 0.02, height);

  endShape(CLOSE);
  drawingContext.restore();

  // 창문 안쪽
  fill("#dfe8e5");
  rect(width * 0.72, height * 0.35, 220, 260);
}

function drawWindow() {
  noStroke();

  // 벽
  fill("#adc1cd");
  rect(width / 2, height / 2, width - 120, height - 120);

  // 창의 위치와 크기
  let windowX = width * 0.67;
  let windowY = height * 0.42;

  let windowW = (width - 120) * 0.6;
  let windowH = 440;

  // 창틀 전체
  fill("#3e1921");
  rect(windowX, windowY, windowW, windowH);

  // 창 안쪽
  fill("#dddddd");
  rect(windowX, windowY - 10, windowW - 40, 340);

  // 십자 창틀 - 세로
  fill("#3e1921");
  rect(windowX, windowY - 10, 18, 340);

  // 십자 창틀 - 가로
  fill("#3e1921");
  rect(windowX, windowY - 10, windowW - 40, 18);

  // 창틀 아랫변
  fill("#bab076");
  rect(windowX, windowY + 180, windowW, 45);
}

function drawNextButton() {
  noStroke();

  // 버튼
  function drawDustButton(x, y, label) {
    push();
    translate(x, y);
    fill(30);

    // 먼지 몸통
    ellipse(0, 0, 28, 28);

    // Dust 클래스와 같은 돌기
    for (let i = 0; i < 8; i++) {
      let angle = (TWO_PI / 8) * i;
      let dustX = cos(angle) * 14.7;
      let dustY = sin(angle) * 14.7;
      ellipse(dustX, dustY, 28 * 0.25, 28 * 0.25);
    }

    // 번호
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(10);
    text(label, 0, 0);

    pop();
  }

  drawDustButton(width - 170, height - 50, "01");
  drawDustButton(width - 120, height - 50, "02");
  drawDustButton(width - 70, height - 50, "03");
}
