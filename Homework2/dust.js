class Dust {
  constructor(x, y, size, colorValue = null) {
    this.size = size;

    if (colorValue !== null) {
      this.color = colorValue;
    } else {
      this.color = random(20, 70);
    }
    this.body = Bodies.circle(x, y, this.size);
    this.floating = false;
    this.floatX = random(-0.8, 0.8);
    this.floatY = random(-1.5, -0.8);
    this.floatSlow = 0.015;

    Composite.add(engine.world, this.body);
  }

  // 먼지가 떠다니는 움직임
  float() {
    if (!this.floating) {
      return;
    }

    this.floatY *= 0.998;

    if (this.floatY > -0.7) {
      this.floatY = -0.7;
    }

    this.floatX *= 0.995;

    Body.setPosition(this.body, {
      x: this.body.position.x + this.floatX,
      y: this.body.position.y + this.floatY,
    });
  }

  display() {
    this.pos = this.body.position;
    push();
    translate(this.pos.x, this.pos.y);

    // 먼지 몸통
    noStroke();
    fill(this.color);
    ellipse(0, 0, this.size * 2, this.size * 2);

    // 돌기
    for (let i = 0; i < 8; i++) {
      let angle = (TWO_PI / 8) * i;
      let x = cos(angle) * this.size * 1.05;
      let y = sin(angle) * this.size * 1.05;
      ellipse(x, y, this.size * 0.25, this.size * 0.25);
    }
    pop();
  }
}
