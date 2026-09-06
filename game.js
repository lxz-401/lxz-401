/**
 * ====================================================================
 *   GIT-BREAKOUT: Interactive GitHub Contribution Game Engine
 *   Developer: lxz-401 (FullStack WEB Developer, Navoiy)
 *   GitHub: https://github.com/lxz-401
 * ====================================================================
 */

(function () {
  // DOM Elements
  const canvas = document.getElementById('breakoutCanvas');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('gameOverlay');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlaySubtitle = document.getElementById('overlaySubtitle');
  const startBtn = document.getElementById('startBtn');
  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const terminalInput = document.getElementById('terminalInput');
  const consoleOutput = document.getElementById('consoleOutput');

  // Stats Elements
  const scoreVal = document.getElementById('scoreVal');
  const streakVal = document.getElementById('streakVal');
  const livesVal = document.getElementById('livesVal');
  const levelVal = document.getElementById('levelVal');
  const destroyedVal = document.getElementById('destroyedVal');

  // Audio Context (Synthesizer)
  let audioCtx = null;
  let soundEnabled = true;

  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playTone(freq, type = 'sine', duration = 0.08, rampTo = null) {
    if (!soundEnabled || !audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      if (rampTo !== null) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, rampTo), audioCtx.currentTime + duration);
      }
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      // Audio context policy safe catch
    }
  }

  const sfx = {
    paddleHit: () => playTone(340, 'triangle', 0.1, 560),
    wallHit: () => playTone(280, 'sine', 0.05, 200),
    brickHit: (lvl) => {
      const freqs = [350, 480, 620, 780, 960];
      playTone(freqs[lvl] || 500, 'square', 0.07);
    },
    powerup: () => {
      playTone(400, 'sine', 0.08, 600);
      setTimeout(() => playTone(600, 'sine', 0.08, 900), 70);
      setTimeout(() => playTone(900, 'sine', 0.15, 1200), 140);
    },
    lifeLost: () => {
      playTone(280, 'sawtooth', 0.2, 90);
    },
    win: () => {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((n, i) => {
        setTimeout(() => playTone(n, 'triangle', 0.25), i * 140);
      });
    }
  };

  // Sound Toggle
  if (soundToggleBtn) {
    soundToggleBtn.addEventListener('click', () => {
      initAudio();
      soundEnabled = !soundEnabled;
      soundToggleBtn.textContent = soundEnabled ? '🔊 Sound: ON' : '🔇 Sound: OFF';
      logToTerminal(`Sound effect set to: ${soundEnabled ? 'ENABLED' : 'MUTED'}`, 'log-info');
    });
  }

  // Terminal Logger
  function logToTerminal(msg, className = '') {
    if (!consoleOutput) return;
    const time = new Date().toTimeString().split(' ')[0];
    const el = document.createElement('div');
    if (className) el.className = className;
    el.innerHTML = `<span style="color:#6e7681">[${time}]</span> ${msg}`;
    consoleOutput.appendChild(el);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
  }

  // Canvas Dimensions
  const V_WIDTH = 1000;
  const V_HEIGHT = 480;
  canvas.width = V_WIDTH;
  canvas.height = V_HEIGHT;

  // GitHub Palette
  const PALETTE = {
    empty: '#161b22',
    level1: '#0e4429',
    level2: '#006d32',
    level3: '#26a641',
    level4: '#39d353',
    paddle: '#1f6feb',
    ball: '#58a6ff',
    laser: '#ff7b72'
  };

  // Game State
  let currentLevel = 1;
  let score = 0;
  let streak = 0;
  let maxStreak = 0;
  let lives = 3;
  let totalDestroyed = 0;
  let isRunning = false;
  let isPaused = false;
  let hasLaunched = false;

  // Paddle
  const PADDLE_BASE_WIDTH = 130;
  const PADDLE_HEIGHT = 16;
  const paddle = {
    x: (V_WIDTH - PADDLE_BASE_WIDTH) / 2,
    y: V_HEIGHT - 38,
    width: PADDLE_BASE_WIDTH,
    height: PADDLE_HEIGHT,
    speed: 10,
    dx: 0,
    targetX: (V_WIDTH - PADDLE_BASE_WIDTH) / 2,
    powerupTimer: 0
  };

  // Balls Array (supports multi-ball powerup)
  let balls = [];

  function createBall(x, y, dx = 0, dy = -6) {
    return {
      x: x,
      y: y,
      radius: 8,
      dx: dx,
      dy: dy,
      speed: 6.5,
      trail: [],
      superMode: false
    };
  }

  // Bricks Grid
  const BRICK_ROWS = 7;
  const BRICK_COLS = 52;
  const BRICK_GAP = 4;
  const GRID_LEFT_OFFSET = 20;
  const GRID_TOP_OFFSET = 24;

  const totalGridWidth = V_WIDTH - (GRID_LEFT_OFFSET * 2);
  const BRICK_WIDTH = (totalGridWidth - (BRICK_COLS - 1) * BRICK_GAP) / BRICK_COLS;
  const BRICK_HEIGHT = 14;

  let bricks = [];

  // Particles Array
  let particles = [];

  // Powerups Array
  let powerups = [];

  const POWERUP_TYPES = [
    { type: 'multiball', symbol: '🌿', color: '#3fb950', name: 'git branch (Multi-Ball)' },
    { type: 'wide', symbol: '📏', color: '#58a6ff', name: 'Wide Paddle' },
    { type: 'super', symbol: '⚡', color: '#f1e05a', name: 'git push --force (Piercing Ball)' },
    { type: 'slow', symbol: '⏱️', color: '#bc8cff', name: 'Debug Mode (Slow-Mo)' },
    { type: 'life', symbol: '❤️', color: '#f85149', name: 'Merge PR (+1 Life)' }
  ];

  // Letter matrix for Level 2 "LXZ-401"
  const LOGO_MATRIX_7x52 = [
    // 7 rows of 52 characters
    "  ██       ██   ██ ███████        ██   ██  ██████   ██  ",
    "  ██        ██ ██  ╚══███╔        ██   ██ ██╔═████ ███  ",
    "  ██         ███     ███╔  █████  ██   ██ ██ ██╔██  ██  ",
    "  ██        ██ ██   ███╔   ╚════  ███████ ████╔╝██  ██  ",
    "  ███████  ██   ██ ███████             ██  ╚██████  ██  ",
    "  ╚══════  ╚═   ══ ╚══════             ╚═   ╚═════  ╚═  ",
    "  ================ lxz-401 = Navoiy ==================  "
  ];

  function initLevel(levelNum) {
    bricks = [];
    currentLevel = levelNum;
    if (levelVal) levelVal.textContent = levelNum;

    for (let r = 0; r < BRICK_ROWS; r++) {
      bricks[r] = [];
      for (let c = 0; c < BRICK_COLS; c++) {
        let level = 0;

        if (levelNum === 1) {
          // GitHub realistic heatmap distribution
          const noise = Math.sin(r * 12.3 + c * 3.7) + Math.cos(r * 5.1 - c * 8.2);
          if (noise > 1.2) level = 4;
          else if (noise > 0.6) level = 3;
          else if (noise > -0.1) level = 2;
          else if (noise > -0.9) level = 1;
          else level = 0;
        } else if (levelNum === 2) {
          // "LXZ-401" ASCII Logo level
          const char = LOGO_MATRIX_7x52[r] ? LOGO_MATRIX_7x52[r][c] : ' ';
          if (char === '█') level = 4;
          else if (char === '═' || char === '╔' || char === '╚' || char === '╝' || char === '║') level = 2;
          else if (char && char !== ' ') level = 3;
          else level = 0;
        } else {
          // Boss challenge: Dense high commit matrix
          level = (r % 2 === 0) ? 4 : 3;
          if (c % 5 === 0) level = 2;
        }

        const x = GRID_LEFT_OFFSET + c * (BRICK_WIDTH + BRICK_GAP);
        const y = GRID_TOP_OFFSET + r * (BRICK_HEIGHT + BRICK_GAP);

        bricks[r][c] = {
          x,
          y,
          width: BRICK_WIDTH,
          height: BRICK_HEIGHT,
          level: level,
          alive: level > 0
        };
      }
    }

    resetBallAndPaddle();
    logToTerminal(`Loaded Level ${levelNum}: ${levelNum === 1 ? 'Yearly Heatmap' : levelNum === 2 ? 'LXZ-401 Logo' : 'Boss Matrix'}`, 'log-info');
  }

  function resetBallAndPaddle() {
    paddle.width = PADDLE_BASE_WIDTH;
    paddle.x = (V_WIDTH - paddle.width) / 2;
    paddle.targetX = paddle.x;
    paddle.powerupTimer = 0;

    hasLaunched = false;
    balls = [createBall(paddle.x + paddle.width / 2, paddle.y - 10, 0, 0)];
  }

  function launchBall() {
    if (!hasLaunched && balls.length > 0) {
      initAudio();
      hasLaunched = true;
      const angle = (Math.random() * 0.6 - 0.3) * Math.PI; // slight random angle upward
      const speed = balls[0].speed;
      balls[0].dx = speed * Math.sin(angle) || 3;
      balls[0].dy = -Math.abs(speed * Math.cos(angle));
      sfx.paddleHit();
      logToTerminal(`git commit -m 'Ball pushed to origin' 🚀`, 'log-hit');
    }
  }

  // Controls Event Listeners
  const keys = {};

  window.addEventListener('keydown', (e) => {
    // If typing in the terminal input, don't trigger game key actions except Enter
    if (document.activeElement === terminalInput) {
      return;
    }

    keys[e.code] = true;

    if (e.code === 'Space') {
      e.preventDefault();
      if (!isRunning) {
        startGame();
      } else if (!hasLaunched) {
        launchBall();
      } else {
        togglePause();
      }
    }

    if (e.code === 'KeyR') {
      restartGame();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (document.activeElement === terminalInput) return;
    keys[e.code] = false;
  });

  // Mouse / Touch Controls
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = V_WIDTH / rect.width;
    const mouseX = (e.clientX - rect.left) * scaleX;
    paddle.targetX = Math.max(0, Math.min(V_WIDTH - paddle.width, mouseX - paddle.width / 2));
  });

  canvas.addEventListener('click', () => {
    initAudio();
    if (!isRunning) {
      startGame();
    } else if (!hasLaunched) {
      launchBall();
    }
  });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (e.touches.length > 0) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = V_WIDTH / rect.width;
      const touchX = (e.touches[0].clientX - rect.left) * scaleX;
      paddle.targetX = Math.max(0, Math.min(V_WIDTH - paddle.width, touchX - paddle.width / 2));
    }
  }, { passive: false });

  canvas.addEventListener('touchstart', (e) => {
    initAudio();
    if (!isRunning) {
      startGame();
    } else if (!hasLaunched) {
      launchBall();
    }
  });

  startBtn.addEventListener('click', () => {
    initAudio();
    startGame();
  });

  function startGame() {
    isRunning = true;
    isPaused = false;
    score = 0;
    streak = 0;
    lives = 3;
    totalDestroyed = 0;
    particles = [];
    powerups = [];
    updateStatsUI();
    overlay.classList.add('hidden');
    initLevel(1);
    logToTerminal("Game started! Terminal connection established.", 'log-info');
  }

  function restartGame() {
    startGame();
  }

  function togglePause() {
    isPaused = !isPaused;
    if (isPaused) {
      overlayTitle.textContent = "GAME PAUSED";
      overlaySubtitle.textContent = "Press [SPACE] to resume hacking commits";
      startBtn.textContent = "Resume Game";
      overlay.classList.remove('hidden');
      logToTerminal("Process suspended (SIGSTOP)", 'log-info');
    } else {
      overlay.classList.add('hidden');
      logToTerminal("Process resumed (SIGCONT)", 'log-info');
    }
  }

  function updateStatsUI() {
    if (scoreVal) scoreVal.textContent = score;
    if (streakVal) streakVal.textContent = `x${streak}`;
    if (livesVal) livesVal.textContent = '♥ '.repeat(Math.max(0, lives)).trim();
    if (destroyedVal) destroyedVal.textContent = totalDestroyed;
  }

  // Particle Explosions
  function spawnParticles(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4 + 1;
      particles.push({
        x: x,
        y: y,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        size: Math.random() * 3 + 2,
        color: color,
        alpha: 1,
        life: 0.95
      });
    }
  }

  // Spawn Power-up with ~20% chance
  function maybeSpawnPowerup(x, y) {
    if (Math.random() < 0.22) {
      const p = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
      powerups.push({
        x: x,
        y: y,
        type: p.type,
        symbol: p.symbol,
        color: p.color,
        name: p.name,
        width: 24,
        height: 24,
        dy: 2.2
      });
    }
  }

  function activatePowerup(pu) {
    sfx.powerup();
    logToTerminal(`POWER-UP COLLECTED: ${pu.name}`, 'log-powerup');

    if (pu.type === 'multiball') {
      const currentBalls = [...balls];
      currentBalls.forEach(b => {
        balls.push(createBall(b.x, b.y, b.dx + 2, b.dy - 1));
        balls.push(createBall(b.x, b.y, b.dx - 2, b.dy - 1));
      });
    } else if (pu.type === 'wide') {
      paddle.width = PADDLE_BASE_WIDTH * 1.5;
      paddle.powerupTimer = 600; // ~10 seconds
    } else if (pu.type === 'super') {
      balls.forEach(b => b.superMode = true);
      setTimeout(() => {
        balls.forEach(b => b.superMode = false);
      }, 7000);
    } else if (pu.type === 'slow') {
      balls.forEach(b => {
        b.dx *= 0.65;
        b.dy *= 0.65;
      });
    } else if (pu.type === 'life') {
      lives = Math.min(5, lives + 1);
      updateStatsUI();
    }
  }

  // Game Loop Update
  function update() {
    if (!isRunning || isPaused) return;

    // Paddle Movement (Keyboard or Mouse Lerp)
    if (keys['ArrowLeft'] || keys['KeyA']) {
      paddle.x -= paddle.speed;
      paddle.targetX = paddle.x;
    } else if (keys['ArrowRight'] || keys['KeyD']) {
      paddle.x += paddle.speed;
      paddle.targetX = paddle.x;
    } else {
      // Smooth lerp to mouse target
      paddle.x += (paddle.targetX - paddle.x) * 0.35;
    }

    // Clamp paddle within bounds
    paddle.x = Math.max(0, Math.min(V_WIDTH - paddle.width, paddle.x));

    // Handle paddle timer
    if (paddle.powerupTimer > 0) {
      paddle.powerupTimer--;
      if (paddle.powerupTimer === 0) {
        paddle.width = PADDLE_BASE_WIDTH;
      }
    }

    // Stick ball to paddle before launch
    if (!hasLaunched && balls.length > 0) {
      balls[0].x = paddle.x + paddle.width / 2;
      balls[0].y = paddle.y - balls[0].radius - 1;
    }

    // Update Balls
    for (let i = balls.length - 1; i >= 0; i--) {
      const ball = balls[i];
      if (!hasLaunched) continue;

      // Ball trails
      ball.trail.unshift({ x: ball.x, y: ball.y, super: ball.superMode });
      if (ball.trail.length > 6) ball.trail.pop();

      // Next position
      ball.x += ball.dx;
      ball.y += ball.dy;

      // Wall collisions
      if (ball.x - ball.radius <= 0) {
        ball.x = ball.radius;
        ball.dx = Math.abs(ball.dx);
        sfx.wallHit();
      } else if (ball.x + ball.radius >= V_WIDTH) {
        ball.x = V_WIDTH - ball.radius;
        ball.dx = -Math.abs(ball.dx);
        sfx.wallHit();
      }

      if (ball.y - ball.radius <= 0) {
        ball.y = ball.radius;
        ball.dy = Math.abs(ball.dy);
        sfx.wallHit();
      }

      // Paddle collision
      if (
        ball.dy > 0 &&
        ball.y + ball.radius >= paddle.y &&
        ball.y - ball.radius <= paddle.y + paddle.height &&
        ball.x >= paddle.x &&
        ball.x <= paddle.x + paddle.width
      ) {
        ball.dy = -Math.abs(ball.dy);
        sfx.paddleHit();

        // Calculate bounce angle depending on hit location
        const hitOffset = (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2);
        const maxAngle = Math.PI / 2.7; // ~66 degrees
        const angle = hitOffset * maxAngle;
        const currentSpeed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
        ball.dx = currentSpeed * Math.sin(angle);
        ball.dy = -currentSpeed * Math.cos(angle);

        streak++;
        if (streak > maxStreak) maxStreak = streak;
        score += 10 * streak;
        updateStatsUI();
      }

      // Brick collisions
      let hitBrickThisFrame = false;
      for (let r = 0; r < BRICK_ROWS; r++) {
        for (let c = 0; c < BRICK_COLS; c++) {
          const b = bricks[r][c];
          if (!b.alive) continue;

          // AABB check
          if (
            ball.x + ball.radius >= b.x &&
            ball.x - ball.radius <= b.x + b.width &&
            ball.y + ball.radius >= b.y &&
            ball.y - ball.radius <= b.y + b.height
          ) {
            // Hit detected!
            sfx.brickHit(b.level);

            const hitLvl = b.level;
            const brickColor = PALETTE[`level${hitLvl}`] || PALETTE.level4;
            spawnParticles(b.x + b.width / 2, b.y + b.height / 2, brickColor, 8);

            if (!ball.superMode) {
              // Standard bounce reflection
              if (!hitBrickThisFrame) {
                // Determine collision side
                const overlapLeft = (ball.x + ball.radius) - b.x;
                const overlapRight = (b.x + b.width) - (ball.x - ball.radius);
                const overlapTop = (ball.y + ball.radius) - b.y;
                const overlapBottom = (b.y + b.height) - (ball.y - ball.radius);

                const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
                if (minOverlap === overlapLeft || minOverlap === overlapRight) {
                  ball.dx = -ball.dx;
                } else {
                  ball.dy = -ball.dy;
                }
                hitBrickThisFrame = true;
              }
            }

            // Damage brick
            b.level--;
            if (b.level <= 0) {
              b.alive = false;
              totalDestroyed++;
              maybeSpawnPowerup(b.x + b.width / 2, b.y + b.height / 2);
            }

            score += hitLvl * 50 * (streak + 1);
            streak++;
            if (streak > maxStreak) maxStreak = streak;
            updateStatsUI();

            if (Math.random() < 0.2) {
              logToTerminal(`[COMMIT CLEARED] feat(hack): destroyed lvl ${hitLvl} commit! +${hitLvl * 50} pts`, 'log-hit');
            }

            if (!ball.superMode) break;
          }
        }
        if (hitBrickThisFrame && !ball.superMode) break;
      }

      // Ball fell off bottom
      if (ball.y - ball.radius > V_HEIGHT) {
        balls.splice(i, 1);
      }
    }

    // If all balls lost
    if (balls.length === 0) {
      lives--;
      streak = 0;
      updateStatsUI();
      sfx.lifeLost();

      if (lives <= 0) {
        // Game Over
        isRunning = false;
        overlayTitle.textContent = "MERGE CONFLICT (GAME OVER)";
        overlaySubtitle.textContent = `You scored ${score} pts with a streak of x${maxStreak}. Press restart to build again!`;
        startBtn.textContent = "Retry / Git Rebase";
        overlay.classList.remove('hidden');
        logToTerminal(`FATAL: Build failed. Final Score: ${score}`, 'log-fail');
      } else {
        logToTerminal(`Branch lost! Remaining branches (lives): ${lives}`, 'log-fail');
        resetBallAndPaddle();
      }
    }

    // Check Victory (all bricks broken)
    let activeBricks = 0;
    for (let r = 0; r < BRICK_ROWS; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
        if (bricks[r][c].alive) activeBricks++;
      }
    }

    if (activeBricks === 0) {
      sfx.win();
      logToTerminal(`🎉 LEVEL ${currentLevel} COMPLETED! All commits successfully merged!`, 'log-powerup');
      if (currentLevel < 3) {
        currentLevel++;
        initLevel(currentLevel);
      } else {
        isRunning = false;
        overlayTitle.textContent = "🎉 YOU WON THE GIT UNIVERSE!";
        overlaySubtitle.textContent = `Incredible! All 3 levels cleared! Final Score: ${score}. lxz-401 is a Master Developer!`;
        startBtn.textContent = "Play Again";
        overlay.classList.remove('hidden');
      }
    }

    // Update Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.dx;
      p.y += p.dy;
      p.alpha *= p.life;
      if (p.alpha < 0.03) {
        particles.splice(i, 1);
      }
    }

    // Update Powerups
    for (let i = powerups.length - 1; i >= 0; i--) {
      const pu = powerups[i];
      pu.y += pu.dy;

      // Check paddle catch
      if (
        pu.y + pu.height >= paddle.y &&
        pu.y <= paddle.y + paddle.height &&
        pu.x >= paddle.x &&
        pu.x <= paddle.x + paddle.width
      ) {
        activatePowerup(pu);
        powerups.splice(i, 1);
        continue;
      }

      // Check fell off bottom
      if (pu.y > V_HEIGHT) {
        powerups.splice(i, 1);
      }
    }
  }

  // Draw Helper: Rounded Rectangle
  function drawRoundedRect(ctx, x, y, width, height, radius, fillStyle, strokeStyle = null) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();

    if (fillStyle) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
    if (strokeStyle) {
      ctx.strokeStyle = strokeStyle;
      ctx.stroke();
    }
  }

  // Render Loop
  function draw() {
    ctx.clearRect(0, 0, V_WIDTH, V_HEIGHT);

    // Subtle background grid
    ctx.fillStyle = '#0a0d12';
    ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);

    // Render Bricks (Contribution Heatmap)
    for (let r = 0; r < BRICK_ROWS; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
        const b = bricks[r][c];
        let color = PALETTE.empty;
        if (b.alive) {
          color = PALETTE[`level${b.level}`] || PALETTE.level4;
        }

        // Draw contribution square (rounded like GitHub tiles)
        drawRoundedRect(ctx, b.x, b.y, b.width, b.height, 3, color, b.alive ? null : '#1b2129');

        // If level 4 or 3, give subtle gloss/glow
        if (b.alive && b.level >= 3) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
          ctx.fillRect(b.x + 1, b.y + 1, b.width - 2, 2);
        }
      }
    }

    // Render Powerups
    powerups.forEach(pu => {
      drawRoundedRect(ctx, pu.x - 12, pu.y, pu.width, pu.height, 5, '#161b22', pu.color);
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pu.symbol, pu.x, pu.y + 12);
    });

    // Render Particles
    particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Render Paddle (Electric Blue Pill from screenshot)
    ctx.save();
    ctx.shadowColor = 'rgba(31, 111, 235, 0.6)';
    ctx.shadowBlur = 12;
    drawRoundedRect(ctx, paddle.x, paddle.y, paddle.width, paddle.height, 8, PALETTE.paddle);
    ctx.restore();

    // Render Balls (Electric Blue Spheres with glow and trails)
    balls.forEach(ball => {
      // Draw trails
      ball.trail.forEach((t, index) => {
        ctx.save();
        const alpha = (1 - index / ball.trail.length) * 0.4;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = t.super ? '#f1e05a' : PALETTE.ball;
        ctx.beginPath();
        ctx.arc(t.x, t.y, ball.radius * (1 - index / 10), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Draw Main Ball
      ctx.save();
      ctx.shadowColor = ball.superMode ? 'rgba(241, 224, 90, 0.9)' : 'rgba(88, 166, 255, 0.8)';
      ctx.shadowBlur = ball.superMode ? 20 : 12;
      ctx.fillStyle = ball.superMode ? '#f1e05a' : PALETTE.ball;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fill();

      // Ball gloss highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.beginPath();
      ctx.arc(ball.x - 2.5, ball.y - 2.5, ball.radius * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Launch hint if ball ready on paddle
    if (!hasLaunched && isRunning && !isPaused) {
      ctx.fillStyle = '#8b949e';
      ctx.font = '13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Press [SPACE] or Click to Launch Commit', V_WIDTH / 2, paddle.y - 25);
    }
  }

  // Animation Loop
  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  // Handle Terminal CLI Inputs
  if (terminalInput) {
    terminalInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const rawCmd = terminalInput.value.trim();
        terminalInput.value = '';
        if (!rawCmd) return;

        logToTerminal(`$ ${rawCmd}`, 'log-info');
        processTerminalCommand(rawCmd.toLowerCase());
      }
    });
  }

  function processTerminalCommand(cmd) {
    const parts = cmd.split(' ');
    const root = parts[0];

    switch (root) {
      case 'help':
        logToTerminal("Commands: whoami, skills, projects, stats, level <1-3>, pause, restart, sound, cheat, clear", 'log-powerup');
        break;
      case 'whoami':
        logToTerminal("lxz-401 | FullStack WEB Developer | Navoiy, Uzbekistan | Status: open for collaboration", 'log-hit');
        break;
      case 'skills':
        logToTerminal("SKILLS: React (8), JS (6), Python (6), TypeScript (5), Django (5), Node (2)", 'log-hit');
        break;
      case 'projects':
        logToTerminal("1. Instagram → Telegram Bot (Python)  2. Web Portfolio (Next.js)  3. Automation Scripts", 'log-hit');
        break;
      case 'stats':
        logToTerminal("15+ Repositories | 500+ Commits | 50+ Stars | 30 Days Streak", 'log-hit');
        break;
      case 'level':
        const lvl = parseInt(parts[1], 10);
        if (lvl >= 1 && lvl <= 3) {
          initLevel(lvl);
        } else {
          logToTerminal("Usage: level 1 | level 2 | level 3", 'log-fail');
        }
        break;
      case 'sound':
        soundEnabled = !soundEnabled;
        logToTerminal(`Sound toggled: ${soundEnabled ? 'ON' : 'OFF'}`);
        if (soundToggleBtn) soundToggleBtn.textContent = soundEnabled ? '🔊 Sound: ON' : '🔇 Sound: OFF';
        break;
      case 'cheat':
      case 'godmode':
        balls.forEach(b => b.superMode = true);
        paddle.width = PADDLE_BASE_WIDTH * 1.8;
        lives = 5;
        updateStatsUI();
        logToTerminal("🔥 GODMODE ENABLED: Sudo access granted! Super ball + Wide paddle", 'log-powerup');
        break;
      case 'ball':
        if (balls.length > 0) {
          balls.push(createBall(paddle.x + paddle.width / 2, paddle.y - 10, (Math.random() - 0.5) * 6, -6));
          logToTerminal("Spawned extra branch ball!", 'log-powerup');
        }
        break;
      case 'pause':
        togglePause();
        break;
      case 'restart':
        restartGame();
        break;
      case 'clear':
        if (consoleOutput) consoleOutput.innerHTML = '';
        break;
      default:
        logToTerminal(`bash: command not found: ${root}. Type 'help' for available commands.`, 'log-fail');
    }
  }

  // Initialize
  initLevel(1);
  loop();

  // Welcome terminal messages
  logToTerminal("Terminal Git-Breakout v1.0 initialized.", 'log-info');
  logToTerminal("Type 'help' in the terminal prompt below or press [START PLAYING].", 'log-hit');
})();
