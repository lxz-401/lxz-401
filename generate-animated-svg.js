/**
 * Generates an ultra-smooth, looping animated SVG (git-breakout.svg)
 * depicting the GitHub contribution Breakout game playing automatically!
 */

const fs = require('fs');
const path = require('path');

const SVG_WIDTH = 920;
const SVG_HEIGHT = 280;

const BRICK_ROWS = 7;
const BRICK_COLS = 52;
const BRICK_GAP = 3.5;
const GRID_LEFT = 24;
const GRID_TOP = 20;

const totalGridW = SVG_WIDTH - GRID_LEFT * 2;
const BRICK_WIDTH = (totalGridW - (BRICK_COLS - 1) * BRICK_GAP) / BRICK_COLS;
const BRICK_HEIGHT = 12;

const PADDLE_WIDTH = 100;
const PADDLE_HEIGHT = 14;
const PADDLE_Y = SVG_HEIGHT - 28;

const BALL_RADIUS = 8;
const DURATION = 14; // 14 seconds loop
const FPS = 30;
const TOTAL_FRAMES = DURATION * FPS;

// Initial Bricks Matrix
const bricks = [];
for (let r = 0; r < BRICK_ROWS; r++) {
  bricks[r] = [];
  for (let c = 0; c < BRICK_COLS; c++) {
    const seed = Math.sin(r * 11.7 + c * 5.3) + Math.cos(r * 3.1 - c * 7.9);
    let level = 0;
    if (seed > 1.1) level = 4;
    else if (seed > 0.5) level = 3;
    else if (seed > -0.15) level = 2;
    else if (seed > -0.85) level = 1;
    else level = 0;

    const x = GRID_LEFT + c * (BRICK_WIDTH + BRICK_GAP);
    const y = GRID_TOP + r * (BRICK_HEIGHT + BRICK_GAP);

    bricks[r][c] = {
      id: `b_${r}_${c}`,
      x,
      y,
      initialLevel: level,
      currentLevel: level,
      hitFrames: []
    };
  }
}

// Ball & Paddle Physics
let ball = {
  x: SVG_WIDTH / 2,
  y: PADDLE_Y - BALL_RADIUS - 2,
  dx: 5.2,
  dy: -5.8,
  speed: 7.8
};

let paddle = {
  x: (SVG_WIDTH - PADDLE_WIDTH) / 2,
  width: PADDLE_WIDTH
};

const ballFrames = [];
const paddleFrames = [];
const particles = [];
let score = 0;
const scoreFrames = [];

// Physics Simulation Loop
for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
  const time = frame / FPS;

  // AI Paddle Movement
  // Predict ball intercept
  let targetPaddleX = ball.x - PADDLE_WIDTH / 2;
  if (ball.dy > 0) {
    const timeToHit = (PADDLE_Y - ball.y) / ball.dy;
    let predictedX = ball.x + ball.dx * timeToHit;
    if (predictedX < 0) predictedX = -predictedX;
    if (predictedX > SVG_WIDTH) predictedX = SVG_WIDTH * 2 - predictedX;
    targetPaddleX = predictedX - PADDLE_WIDTH / 2;
  }
  targetPaddleX = Math.max(10, Math.min(SVG_WIDTH - PADDLE_WIDTH - 10, targetPaddleX));
  paddle.x += (targetPaddleX - paddle.x) * 0.28;

  // Ball Movement
  ball.x += ball.dx;
  ball.y += ball.dy;

  // Wall collisions
  if (ball.x - BALL_RADIUS <= 10) {
    ball.x = 10 + BALL_RADIUS;
    ball.dx = Math.abs(ball.dx);
  } else if (ball.x + BALL_RADIUS >= SVG_WIDTH - 10) {
    ball.x = SVG_WIDTH - 10 - BALL_RADIUS;
    ball.dx = -Math.abs(ball.dx);
  }

  if (ball.y - BALL_RADIUS <= 10) {
    ball.y = 10 + BALL_RADIUS;
    ball.dy = Math.abs(ball.dy);
  }

  // Paddle collision
  if (
    ball.dy > 0 &&
    ball.y + BALL_RADIUS >= PADDLE_Y &&
    ball.y - BALL_RADIUS <= PADDLE_Y + PADDLE_HEIGHT &&
    ball.x >= paddle.x - 5 &&
    ball.x <= paddle.x + PADDLE_WIDTH + 5
  ) {
    ball.dy = -Math.abs(ball.dy);
    const hitOffset = (ball.x - (paddle.x + PADDLE_WIDTH / 2)) / (PADDLE_WIDTH / 2);
    const angle = hitOffset * 0.9; // angle up to ~50 degrees
    const spd = ball.speed;
    ball.dx = spd * Math.sin(angle);
    ball.dy = -spd * Math.cos(angle);
  }

  // Brick collision
  for (let r = 0; r < BRICK_ROWS; r++) {
    for (let c = 0; c < BRICK_COLS; c++) {
      const b = bricks[r][c];
      if (b.currentLevel <= 0) continue;

      if (
        ball.x + BALL_RADIUS >= b.x &&
        ball.x - BALL_RADIUS <= b.x + BRICK_WIDTH &&
        ball.y + BALL_RADIUS >= b.y &&
        ball.y - BALL_RADIUS <= b.y + BRICK_HEIGHT
      ) {
        // Hit!
        b.currentLevel--;
        b.hitFrames.push({ frame, level: b.currentLevel });
        ball.dy = -ball.dy;
        score += 100;

        // Spark particles
        particles.push({
          x: b.x + BRICK_WIDTH / 2,
          y: b.y + BRICK_HEIGHT / 2,
          startFrame: frame,
          duration: 12
        });
        break;
      }
    }
  }

  // Failsafe if ball falls below paddle (loop reset)
  if (ball.y > SVG_HEIGHT) {
    ball.y = PADDLE_Y - BALL_RADIUS - 2;
    ball.dy = -Math.abs(ball.dy);
  }

  ballFrames.push({
    x: Math.round(ball.x * 10) / 10,
    y: Math.round(ball.y * 10) / 10
  });

  paddleFrames.push(Math.round(paddle.x * 10) / 10);
  scoreFrames.push(score);
}

// Generate Keyframe Strings
const keyTimes = [];
const ballCXValues = [];
const ballCYValues = [];
const paddleXValues = [];

for (let i = 0; i <= TOTAL_FRAMES; i++) {
  const idx = Math.min(i, TOTAL_FRAMES - 1);
  const t = Math.round((i / TOTAL_FRAMES) * 1000) / 1000;
  keyTimes.push(t);
  ballCXValues.push(ballFrames[idx].x);
  ballCYValues.push(ballFrames[idx].y);
  paddleXValues.push(paddleFrames[idx]);
}

// SVG Palette
const PALETTE = {
  empty: '#161b22',
  level1: '#0e4429',
  level2: '#006d32',
  level3: '#26a641',
  level4: '#39d353'
};

// Build SVG Elements
let bricksSvg = '';
for (let r = 0; r < BRICK_ROWS; r++) {
  for (let c = 0; c < BRICK_COLS; c++) {
    const b = bricks[r][c];
    const initialColor = b.initialLevel === 0 ? PALETTE.empty : PALETTE[`level${b.initialLevel}`];

    if (b.hitFrames.length === 0) {
      bricksSvg += `<rect x="${b.x.toFixed(1)}" y="${b.y.toFixed(1)}" width="${BRICK_WIDTH.toFixed(1)}" height="${BRICK_HEIGHT}" rx="2.5" fill="${initialColor}"/>\n`;
    } else {
      // Brick changes color or disappears when hit
      let animValues = [];
      for (let f = 0; f <= TOTAL_FRAMES; f++) {
        let lvl = b.initialLevel;
        for (const hit of b.hitFrames) {
          if (f >= hit.frame) {
            lvl = hit.level;
          }
        }
        const col = lvl <= 0 ? PALETTE.empty : PALETTE[`level${lvl}`];
        animValues.push(col);
      }

      bricksSvg += `<rect x="${b.x.toFixed(1)}" y="${b.y.toFixed(1)}" width="${BRICK_WIDTH.toFixed(1)}" height="${BRICK_HEIGHT}" rx="2.5" fill="${initialColor}">
        <animate attributeName="fill" dur="${DURATION}s" repeatCount="indefinite" values="${animValues.join(';')}" keyTimes="${keyTimes.join(';')}" />
      </rect>\n`;
    }
  }
}

// Complete SVG
const svgContent = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}" width="100%" height="100%" style="background-color: #0d1117; border: 1px solid #30363d; border-radius: 8px;">
  <defs>
    <!-- Glow filter for ball & paddle -->
    <filter id="blue-glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <style>
    .terminal-title { font-family: 'JetBrains Mono', monospace, sans-serif; font-size: 11px; fill: #8b949e; }
    .status-text { font-family: 'JetBrains Mono', monospace, sans-serif; font-size: 11px; fill: #58a6ff; font-weight: bold; }
    .heart { fill: #f85149; }
  </style>

  <!-- Top bar -->
  <rect x="0" y="0" width="${SVG_WIDTH}" height="24" fill="#161b22" />
  <circle cx="15" cy="12" r="4.5" fill="#ff5f56" />
  <circle cx="28" cy="12" r="4.5" fill="#ffbd2e" />
  <circle cx="41" cy="12" r="4.5" fill="#27c93f" />
  <text x="56" y="15.5" class="terminal-title">lxz-401@github: ~/games/git-breakout [AUTO-PLAY]</text>
  <text x="${SVG_WIDTH - 180}" y="15.5" class="status-text">♥ ♥ ♥  SCORE: 1,450</text>

  <!-- Contribution Bricks Matrix -->
  <g id="bricks">
    ${bricksSvg}
  </g>

  <!-- Animated Paddle -->
  <rect id="paddle" y="${PADDLE_Y}" width="${PADDLE_WIDTH}" height="${PADDLE_HEIGHT}" rx="7" fill="#1f6feb" filter="url(#blue-glow)">
    <animate attributeName="x" dur="${DURATION}s" repeatCount="indefinite" values="${paddleXValues.join(';')}" keyTimes="${keyTimes.join(';')}" />
  </rect>

  <!-- Animated Ball -->
  <circle id="ball" r="${BALL_RADIUS}" fill="#58a6ff" filter="url(#blue-glow)">
    <animate attributeName="cx" dur="${DURATION}s" repeatCount="indefinite" values="${ballCXValues.join(';')}" keyTimes="${keyTimes.join(';')}" />
    <animate attributeName="cy" dur="${DURATION}s" repeatCount="indefinite" values="${ballCYValues.join(';')}" keyTimes="${keyTimes.join(';')}" />
  </circle>

  <!-- Bottom subtle line -->
  <line x1="0" y1="${SVG_HEIGHT - 2}" x2="${SVG_WIDTH}" y2="${SVG_HEIGHT - 2}" stroke="#21262d" stroke-width="2" />
</svg>
`.trim();

fs.writeFileSync(path.join(__dirname, 'git-breakout.svg'), svgContent, 'utf8');
console.log('Successfully generated git-breakout.svg!');
