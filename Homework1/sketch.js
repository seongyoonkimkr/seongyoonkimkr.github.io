// const Engine = Matter.Engine;
const Bodies = Matter.Bodies;
// const Composite = Matter.Composite;
const Body = Matter.Body;

let engine;
let circle;
let triangle;
let smallCircle;

let circleAngle = -0.3;
let triangleAngle = -0.8;
let circleSpeed = 0;
let triangleSpeed = 0;
let smallCircleAngle = 0.3;
let smallCircleSpeed = 0;
let gravity = 0.15;

let centerX;
let centerY;
let radius;
let smallRadius;
let bigRadius;

let hit = false;

let squarePosition = 0;
let squareSpeed = 0.00045;

let pendulumAngle = 0.35;
let pendulumSpeed = 0;
let pendulumGravity = 0.001;

function setup() {
  createCanvas(windowWidth, windowHeight);
  rectMode(CENTER);

  // Matter

  // engine = Engine.create();
  // engine.gravity.x = 0;
  // engine.gravity.y = 0;
  centerX = width * 0.32;
  centerY = height * 0.5;
  radius = 240;
  smallRadius = 120;
  bigRadius = 280;

  // circle
  circle = Bodies.circle(width * 0.3, 100, 70, {
    restitution: 0.65,
    friction: 0.65,
    frictionAir: 0.03,
  });

  // triangle
  triangle = Bodies.polygon(width * 0.3 + 80, 100, 3, 25, {
    restitution: 0.3,
    friction: 0.5,
    frictionAir: 0.04,
  });

  // small circle
  smallCircle = Bodies.circle(centerX, centerY + smallRadius, 20, {
    restitution: 0.5,
    friction: 0.5,
    frictionAir: 0.03,
  });

  // Composite.add(engine.world, [circle, triangle, smallCircle]);
}

function draw() {
  // Engine.update(engine);

  background("#fff9e8");

  fill("#000000");
  noStroke();
  rectMode(CORNER);
  rect(width * 0.64, 0, width * 0.5, height);

  rectMode(CENTER);

  // 진자 운동
  pendulumSpeed += -pendulumGravity * sin(pendulumAngle);
  pendulumSpeed *= 0.998;
  pendulumAngle += pendulumSpeed;

  let pivotX = width * 0.82;
  let pivotY = height * 0.15;

  let pendulumLength = 600;

  // 추의 위치
  let pendulumX = pivotX + sin(pendulumAngle) * pendulumLength;

  let pendulumY = pivotY + cos(pendulumAngle) * pendulumLength;

  // 줄
  stroke("#eae6db");
  strokeWeight(2);

  line(pivotX, pivotY, pendulumX, pendulumY);

  // 고정점 역삼각형
  fill("#eae6db");
  noStroke();

  beginShape();
  vertex(pivotX - 60, pivotY - 15);
  vertex(pivotX + 60, pivotY - 15);
  vertex(pivotX, pivotY + 40);
  endShape(CLOSE);

  // 고정점 분할 삼각형
  fill("#a90f73");
  beginShape();
  vertex(pivotX + 60 - 100 / 3, pivotY - 15);
  vertex(pivotX + 60, pivotY - 15);
  vertex(pivotX, pivotY + 40);
  endShape(CLOSE);

  // 돛단배 위치
  let boatX = pivotX + (pendulumX - pivotX) * 0.8;

  let boatY = pivotY + (pendulumY - pivotY) * 0.8;

  // 돛단배 모양
  push();

  translate(boatX, boatY);
  rotate(Math.PI + pendulumAngle * 0.2);

  fill("#eae6db");
  noStroke();

  beginShape();

  vertex(-25, 0);

  for (let a = Math.PI; a <= Math.PI * 2; a += 0.1) {
    vertex(cos(a) * 60, sin(a) * 25);
  }

  vertex(60, 0);

  endShape(CLOSE);

  pop();

  // 동그란 추
  fill("#eae6db");
  noStroke();

  ellipse(pendulumX, pendulumY, 80, 80);

  // 동그란 추 테두리
  noFill();
  stroke("#71d400");
  strokeWeight(4);

  ellipse(pendulumX, pendulumY, 100, 100);

  // 작은 동그란 추
  fill("#ff4c1b");
  noStroke();

  ellipse(pendulumX, pendulumY, 30, 30);

  // 대각선
  stroke(0);
  strokeWeight(1.5);

  line(
    centerX - radius * 1.5,
    centerY + radius * 1.5,
    centerX + radius * 1.5,
    centerY - radius * 1.5,
  );

  // 사각형
  squarePosition += squareSpeed;

  if (squarePosition > 1) {
    squarePosition = 1;
    squareSpeed = 0;
  }

  let squareX = centerX - radius * 1.5 + radius * 3.0 * squarePosition;
  let squareY = centerY + radius * 1.5 - radius * 3.0 * squarePosition;

  fill("#504d4d");
  noStroke();
  rect(squareX, squareY, 15, 15);

  // 궤도
  noFill();
  stroke("#ff4c1b");
  strokeWeight(7);
  ellipse(centerX, centerY, radius * 2, radius * 2);

  noFill();
  stroke("#525252");
  strokeWeight(2);
  ellipse(centerX, centerY, bigRadius * 2, bigRadius * 2);

  noFill();
  stroke("#525252");
  strokeWeight(4);
  ellipse(centerX, centerY, smallRadius * 2, smallRadius * 2);

  // 원의 위치
  circleSpeed += (gravity / radius) * sin(circleAngle);
  circleSpeed *= 0.995;
  circleAngle += circleSpeed;

  // 삼각형의 위치
  triangleSpeed += (gravity / radius) * sin(triangleAngle);
  triangleSpeed *= 0.995;
  triangleAngle += triangleSpeed;

  // 작은 원의 위치
  smallCircleSpeed += (gravity / smallRadius) * sin(smallCircleAngle);
  smallCircleSpeed *= 0.997;
  smallCircleAngle += smallCircleSpeed;

  let x = centerX + sin(circleAngle) * radius;
  let y = centerY - cos(circleAngle) * radius;
  let triangleX = centerX + sin(triangleAngle) * radius;
  let triangleY = centerY - cos(triangleAngle) * radius;
  let smallCircleX = centerX + sin(smallCircleAngle) * smallRadius;
  let smallCircleY = centerY - cos(smallCircleAngle) * smallRadius;

  let d = dist(x, y, triangleX, triangleY);

  if (d < 60 && !hit) {
    let temp = circleSpeed;
    circleSpeed = triangleSpeed;
    triangleSpeed = temp;

    hit = true;
  }

  if (d > 70) {
    hit = false;
  }

  Body.setPosition(circle, { x: x, y: y });
  Body.setPosition(triangle, { x: triangleX, y: triangleY });
  Body.setPosition(smallCircle, { x: smallCircleX, y: smallCircleY });

  // 초록색 원
  fill("#71d400");
  noStroke();
  ellipse(circle.position.x, circle.position.y, 70, 70);

  // 보라색 삼각형
  fill("#a90f73");
  noStroke();
  beginShape();
  for (let v of triangle.vertices) {
    vertex(v.x, v.y);
  }
  endShape(CLOSE);

  // 작은 원
  fill("#210e64");
  noStroke();
  ellipse(smallCircle.position.x, smallCircle.position.y, 30, 30);

  // 부채꼴
  // fill("#736f6f");
  // noStroke();

  // beginShape();
  // vertex(centerX, centerY);
  // arc(
  //   centerX - 100,
  //   centerY - 100,
  //   radius * 1.5,
  //   radius * 1.5,
  //   Math.PI,
  //   Math.PI * 1.5,
  // );
  // vertex(centerX, centerY);
  // endShape(CLOSE);

  // // 부채꼴2
  // fill("#ffee69");
  // noStroke();

  // beginShape();
  // vertex(centerX, centerY);
  // arc(
  //   centerX - 120,
  //   centerY - 120,
  //   radius * 1.5,
  //   radius * 1.5,
  //   Math.PI,
  //   Math.PI * 1.5,
  // );
  // vertex(centerX, centerY);
  // endShape(CLOSE);
}
