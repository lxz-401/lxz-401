#!/usr/bin/env node
/**
 * ====================================================================
 *   GIT-BREAKOUT (Terminal Edition)
 *   Created for: lxz-401 (FullStack WEB Developer)
 *   GitHub: https://github.com/lxz-401
 * ====================================================================
 */

const readline = require('readline');

// Terminal Dimensions
const BOARD_WIDTH = 64;
const BOARD_HEIGHT = 18;
const BRICK_ROWS = 5;
const BRICK_COLS = 26; // 2 chars per brick = 52 cols (like 52 weeks of GitHub)

// GitHub Contribution Color Palette
const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  cyan: '\x1b[38;2;56;189;248m',
  blue: '\x1b[38;2;88;166;255m',
  paddleBlue: '\x1b[38;2;31;111;235m',
  kaliRed: '\x1b[38;2;239;68;68m',
  kaliBlue: '\x1b[38;2;96;165;250m',
  white: '\x1b[38;2;240;246;252m',
  gray: '\x1b[38;2;110;118;129m',
  // Contribution Levels (ANSI 24-bit TrueColor)
  level0: '\x1b[38;2;33;38;45m',   // empty dark slate
  level1: '\x1b[38;2;14;68;41m',   // dark green
  level2: '\x1b[38;2;0;109;50m',   // medium green
  level3: '\x1b[38;2;38;166;65m',  // bright green
  level4: '\x1b[38;2;57;211;83m',  // neon green
};

// State
let score = 0;
let streak = 0;
let maxStreak = 0;
let lives = 3;
let gameOver = false;
let gameWon = false;
let paused = false;
let message = "Press [SPACE] or [ENTER] to launch!";

// Paddle
let paddleWidth = 10;
let paddleX = Math.floor((BOARD_WIDTH - paddleWidth) / 2);
const paddleY = BOARD_HEIGHT - 2;

// Ball
let ballX = paddleX + Math.floor(paddleWidth / 2);
let ballY = paddleY - 1;
let ballDX = 1;
let ballDY = -1;
let ballLaunched = false;

// Bricks grid: 0 (broken) to 4 (high commits)
let bricks = [];
function initBricks() {
  bricks = [];
  // Pattern inspired by GitHub contribution heatmaps
  for (let r = 0; r < BRICK_ROWS; r++) {
    const row = [];
    for (let c = 0; c < BRICK_COLS; c++) {
      const seed = Math.sin(r * 13.5 + c * 7.7);
      let level = 0;
      if (seed > 0.65) level = 4;
      else if (seed > 0.35) level = 3;
      else if (seed > 0.05) level = 2;
      else if (seed > -0.45) level = 1;
      else level = 0;
      row.push(level);
    }
    bricks.push(row);
  }
}

initBricks();

// Setup Keyboard Input
readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
}
process.stdin.resume();

function cleanup() {
  process.stdout.write('\x1b[?25h\x1b[0m\n');
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('exit', () => {
  process.stdout.write('\x1b[?25h\x1b[0m');
});

// Keypress Listener
process.stdin.on('keypress', (str, key) => {
  if (!key) return;

  if (key.ctrl && key.name === 'c') {
    cleanup();
  }

  if (key.name === 'q') {
    cleanup();
  }

  if (key.name === 'left' || key.name === 'a') {
    paddleX = Math.max(1, paddleX - 3);
    if (!ballLaunched) {
      ballX = paddleX + Math.floor(paddleWidth / 2);
    }
  } else if (key.name === 'right' || key.name === 'd') {
    paddleX = Math.min(BOARD_WIDTH - paddleWidth - 1, paddleX + 3);
    if (!ballLaunched) {
      ballX = paddleX + Math.floor(paddleWidth / 2);
    }
  } else if (key.name === 'space' || key.name === 'return') {
    if (gameOver || gameWon) {
      score = 0;
      streak = 0;
      lives = 3;
      gameOver = false;
      gameWon = false;
      paddleWidth = 10;
      paddleX = Math.floor((BOARD_WIDTH - paddleWidth) / 2);
      ballLaunched = false;
      ballX = paddleX + Math.floor(paddleWidth / 2);
      ballY = paddleY - 1;
      ballDX = Math.random() > 0.5 ? 1 : -1;
      ballDY = -1;
      initBricks();
      message = "Game restarted! Good luck!";
    } else if (!ballLaunched) {
      ballLaunched = true;
      ballDX = Math.random() > 0.5 ? 1 : -1;
      ballDY = -1;
      message = "git commit -m 'Deploying ball' 🚀";
    } else {
      paused = !paused;
      message = paused ? "PAUSED (Press Space to resume)" : "Resumed!";
    }
  } else if (key.name === 'r') {
    initBricks();
    ballLaunched = false;
    paddleX = Math.floor((BOARD_WIDTH - paddleWidth) / 2);
    ballX = paddleX + Math.floor(paddleWidth / 2);
    ballY = paddleY - 1;
    score = 0;
    streak = 0;
    message = "Reset contributions map!";
  }
});

function update() {
  if (!ballLaunched || paused || gameOver || gameWon) return;

  const nextX = ballX + ballDX;
  const nextY = ballY + ballDY;

  if (nextX <= 1) {
    ballX = 1;
    ballDX = -ballDX;
  } else if (nextX >= BOARD_WIDTH - 2) {
    ballX = BOARD_WIDTH - 2;
    ballDX = -ballDX;
  } else {
    ballX = nextX;
  }

  if (nextY <= 0) {
    ballY = 0;
    ballDY = -ballDY;
  } else {
    ballY = nextY;
  }

  if (ballY === paddleY && ballDY > 0) {
    if (ballX >= paddleX && ballX <= paddleX + paddleWidth) {
      ballDY = -1;
      const hitOffset = (ballX - (paddleX + paddleWidth / 2)) / (paddleWidth / 2);
      if (hitOffset < -0.3) ballDX = -1;
      else if (hitOffset > 0.3) ballDX = 1;

      streak++;
      if (streak > maxStreak) maxStreak = streak;
      score += 10 * streak;
      message = `Paddle Return! Streak: x${streak}`;
    }
  }

  if (ballY >= BOARD_HEIGHT) {
    lives--;
    streak = 0;
    if (lives <= 0) {
      gameOver = true;
      message = "FATAL: merge conflict! Press [SPACE] to try again.";
    } else {
      ballLaunched = false;
      paddleX = Math.floor((BOARD_WIDTH - paddleWidth) / 2);
      ballX = paddleX + Math.floor(paddleWidth / 2);
      ballY = paddleY - 1;
      ballDY = -1;
      message = `Branch lost! Remaining lives: ${lives}`;
    }
    return;
  }

  const brickStartRow = 1;
  const brickStartCol = 2;
  const relativeY = Math.floor(ballY) - brickStartRow;
  const relativeX = Math.floor(ballX) - brickStartCol;

  if (relativeY >= 0 && relativeY < BRICK_ROWS && relativeX >= 0) {
    const colIdx = Math.floor(relativeX / 2);
    if (colIdx >= 0 && colIdx < BRICK_COLS) {
      const currentLevel = bricks[relativeY][colIdx];
      if (currentLevel > 0) {
        bricks[relativeY][colIdx] = currentLevel - 1;
        ballDY = -ballDY;
        score += currentLevel * 50;
        streak++;
        if (streak > maxStreak) maxStreak = streak;
        message = `Hit commit! [Level ${currentLevel}] +${currentLevel * 50} pts`;

        let remaining = 0;
        for (let r = 0; r < BRICK_ROWS; r++) {
          for (let c = 0; c < BRICK_COLS; c++) {
            if (bricks[r][c] > 0) remaining++;
          }
        }
        if (remaining === 0) {
          gameWon = true;
          message = "🎉 VICTORY! All commits deployed to production!";
        }
      }
    }
  }
}

function render() {
  let out = '\x1b[H\x1b[?25l';

  out += `${COLORS.kaliBlue}┌──(${COLORS.kaliRed}lxz-401㉿github${COLORS.kaliBlue})-[${COLORS.white}~/games/git-breakout${COLORS.kaliBlue}]\n`;
  out += `${COLORS.kaliBlue}└─$ ${COLORS.white}./play --player lxz-401 ${COLORS.gray}| ${COLORS.cyan}Score: ${score} ${COLORS.gray}| ${COLORS.kaliRed}${'♥ '.repeat(lives)}${COLORS.gray}| Streak: x${streak}\n`;
  out += `${COLORS.gray}${'═'.repeat(BOARD_WIDTH)}${COLORS.reset}\n`;

  for (let y = 0; y < BOARD_HEIGHT; y++) {
    let line = `${COLORS.gray}║${COLORS.reset}`;
    for (let x = 1; x < BOARD_WIDTH - 1; x++) {
      if (Math.floor(ballX) === x && Math.floor(ballY) === y) {
        line += `${COLORS.blue}●${COLORS.reset}`;
        continue;
      }

      if (y === paddleY && x >= paddleX && x < paddleX + paddleWidth) {
        line += `${COLORS.paddleBlue}█${COLORS.reset}`;
        continue;
      }

      const bRow = y - 1;
      const bCol = Math.floor((x - 2) / 2);

      if (bRow >= 0 && bRow < BRICK_ROWS && x >= 2 && bCol < BRICK_COLS) {
        const lvl = bricks[bRow][bCol];
        let color = COLORS.level0;
        let char = '░';
        if (lvl === 4) { color = COLORS.level4; char = '█'; }
        else if (lvl === 3) { color = COLORS.level3; char = '▓'; }
        else if (lvl === 2) { color = COLORS.level2; char = '▒'; }
        else if (lvl === 1) { color = COLORS.level1; char = '░'; }
        else { color = COLORS.level0; char = '·'; }

        line += `${color}${char}${COLORS.reset}`;
        continue;
      }

      line += ' ';
    }
    line += `${COLORS.gray}║${COLORS.reset}\n`;
    out += line;
  }

  out += `${COLORS.gray}${'═'.repeat(BOARD_WIDTH)}${COLORS.reset}\n`;

  if (gameOver) {
    out += `${COLORS.kaliRed}${COLORS.bold} [GAME OVER] ${message} ${COLORS.reset}\n`;
  } else if (gameWon) {
    out += `${COLORS.level4}${COLORS.bold} [YOU WIN] ${message} ${COLORS.reset}\n`;
  } else {
    out += `${COLORS.cyan} ℹ ${message}${COLORS.reset}\n`;
  }

  out += `${COLORS.gray} Controls: [← / A] Left  [→ / D] Right  [SPACE] Launch/Pause  [R] Reset  [Q] Quit${COLORS.reset}\n`;

  process.stdout.write(out);
}

process.stdout.write('\x1b[2J\x1b[H');

setInterval(() => {
  update();
  render();
}, 33);
