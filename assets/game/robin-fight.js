const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreText = document.getElementById("scoreText");
const waveText = document.getElementById("waveText");
const healthText = document.getElementById("healthText");
const startPanel = document.getElementById("startPanel");
const playerForm = document.getElementById("playerForm");
const playerNameInput = document.getElementById("playerName");
const scoreList = document.getElementById("scoreList");
const resetScores = document.getElementById("resetScores");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const GROUND_TOP = 420;
const GROUND_BOTTOM = 646;
const SCORE_KEY = "robinman-alley-fight-scores";

const assets = {
  background: loadImage("../assets/game/alley-stage.png"),
  robinman: loadImage("../assets/game/robinman-sheet.png"),
  villains: loadImage("../assets/game/villains-sheet.png"),
  boss: loadImage("../assets/game/boss.png")
};

const keys = new Set();
let playerName = "player";
let state = createState();
let lastTime = 0;
let running = false;

function loadImage(src) {
  const img = new Image();
  img.src = src;
  return img;
}

function createState() {
  return {
    mode: "ready",
    score: 0,
    wave: 1,
    message: "Enter a username",
    shake: 0,
    spawnTimer: 0,
    bossSpawned: false,
    player: {
      x: 170,
      y: 548,
      w: 110,
      h: 178,
      speed: 310,
      hp: 100,
      facing: 1,
      action: "idle",
      actionTimer: 0,
      invuln: 0
    },
    enemies: []
  };
}

const waves = [
  { count: 4, tiers: [0, 0, 0, 1] },
  { count: 6, tiers: [0, 1, 1, 2] },
  { count: 8, tiers: [1, 1, 2, 2] }
];

const tierStats = [
  { hp: 34, speed: 86, damage: 7, score: 120, frame: 0, scale: 0.36 },
  { hp: 66, speed: 64, damage: 12, score: 240, frame: 1, scale: 0.42 },
  { hp: 92, speed: 112, damage: 16, score: 380, frame: 2, scale: 0.4 }
];

function startGame(name) {
  playerName = name || "player";
  state = createState();
  state.mode = "playing";
  startPanel.classList.add("is-hidden");
  running = true;
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function spawnEnemy(tier) {
  const stats = tierStats[tier];
  state.enemies.push({
    tier,
    x: WIDTH + 90 + Math.random() * 160,
    y: GROUND_TOP + 80 + Math.random() * 110,
    w: 120 + tier * 22,
    h: 176 + tier * 22,
    hp: stats.hp,
    maxHp: stats.hp,
    speed: stats.speed,
    damage: stats.damage,
    score: stats.score,
    frame: stats.frame,
    scale: stats.scale,
    hitTimer: 0,
    attackTimer: 0,
    kind: "enemy"
  });
}

function spawnBoss() {
  state.bossSpawned = true;
  state.enemies.push({
    tier: 3,
    x: WIDTH + 160,
    y: 496,
    w: 220,
    h: 290,
    hp: 420,
    maxHp: 420,
    speed: 54,
    damage: 23,
    score: 1500,
    frame: 0,
    scale: 0.22,
    hitTimer: 0,
    attackTimer: 0,
    kind: "boss"
  });
}

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.033);
  lastTime = now;
  update(dt);
  draw();
  if (running) requestAnimationFrame(loop);
}

function update(dt) {
  if (state.mode !== "playing") return;

  updatePlayer(dt);
  updateWave(dt);
  updateEnemies(dt);

  state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);

  if (state.player.hp <= 0) {
    endGame("Game over");
  }

  if (state.wave === 4 && state.bossSpawned && state.enemies.length === 0) {
    state.score += Math.max(0, Math.round(state.player.hp)) * 8;
    endGame("Winner");
  }

  state.shake = Math.max(0, state.shake - dt * 18);
  updateHud();
}

function updatePlayer(dt) {
  const player = state.player;
  let dx = 0;
  let dy = 0;

  if (keys.has("arrowleft") || keys.has("a")) dx -= 1;
  if (keys.has("arrowright") || keys.has("d")) dx += 1;
  if (keys.has("arrowup") || keys.has("w")) dy -= 1;
  if (keys.has("arrowdown") || keys.has("s")) dy += 1;

  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy);
    dx /= len;
    dy /= len;
    player.x += dx * player.speed * dt;
    player.y += dy * player.speed * dt;
    player.action = player.actionTimer > 0 ? player.action : "walk";
    player.facing = dx < 0 ? -1 : dx > 0 ? 1 : player.facing;
  } else if (player.actionTimer <= 0) {
    player.action = "idle";
  }

  player.x = clamp(player.x, 24, WIDTH - player.w - 24);
  player.y = clamp(player.y, GROUND_TOP, GROUND_BOTTOM - 56);
  player.actionTimer = Math.max(0, player.actionTimer - dt);
  player.invuln = Math.max(0, player.invuln - dt);
}

function updateWave(dt) {
  const liveRegulars = state.enemies.filter((enemy) => enemy.kind === "enemy").length;

  if (state.wave <= 3) {
    const wave = waves[state.wave - 1];
    const spawned = state.spawnedInWave || 0;
    state.spawnTimer -= dt;
    if (spawned < wave.count && liveRegulars < 3 && state.spawnTimer <= 0) {
      const tier = wave.tiers[spawned % wave.tiers.length];
      spawnEnemy(tier);
      state.spawnedInWave = spawned + 1;
      state.spawnTimer = 0.85;
    }
    if ((state.spawnedInWave || 0) >= wave.count && state.enemies.length === 0) {
      state.wave += 1;
      state.spawnedInWave = 0;
      state.spawnTimer = 0.8;
      state.score += 250;
    }
    return;
  }

  if (!state.bossSpawned && state.enemies.length === 0) {
    spawnBoss();
  }
}

function updateEnemies(dt) {
  for (const enemy of state.enemies) {
    enemy.hitTimer = Math.max(0, enemy.hitTimer - dt);
    enemy.attackTimer = Math.max(0, enemy.attackTimer - dt);
    const player = state.player;
    const distX = player.x + player.w * 0.5 - (enemy.x + enemy.w * 0.5);
    const distY = player.y - enemy.y;
    const range = enemy.kind === "boss" ? 120 : 82;

    if (Math.abs(distX) > range) {
      enemy.x += Math.sign(distX) * enemy.speed * dt;
    }
    if (Math.abs(distY) > 8) {
      enemy.y += Math.sign(distY) * enemy.speed * 0.58 * dt;
    }

    enemy.y = clamp(enemy.y, GROUND_TOP, GROUND_BOTTOM - 56);

    if (Math.abs(distX) < range && Math.abs(distY) < 62 && enemy.attackTimer <= 0) {
      damagePlayer(enemy.damage);
      enemy.attackTimer = enemy.kind === "boss" ? 0.86 : 1.08;
    }
  }
}

function playerAttack(kind) {
  const player = state.player;
  if (state.mode !== "playing" || player.actionTimer > 0.08) return;

  const isKick = kind === "kick";
  player.action = isKick ? "kick" : "punch";
  player.actionTimer = isKick ? 0.32 : 0.24;

  const reach = isKick ? 168 : 132;
  const damage = isKick ? 28 : 20;
  const start = player.facing === 1 ? player.x + player.w * 0.55 : player.x - reach;
  const hitbox = {
    x: start,
    y: player.y - 18,
    w: reach,
    h: 118
  };

  let landed = false;
  for (const enemy of state.enemies) {
    if (rectsOverlap(hitbox, enemyBox(enemy))) {
      enemy.hp -= damage;
      enemy.hitTimer = 0.18;
      enemy.x += player.facing * (isKick ? 34 : 20);
      state.score += enemy.hp <= 0 ? enemy.score : 18;
      state.shake = Math.max(state.shake, isKick ? 5 : 3);
      landed = true;
    }
  }

  if (!landed) state.score = Math.max(0, state.score - 2);
}

function damagePlayer(amount) {
  const player = state.player;
  if (player.invuln > 0) return;
  player.hp = Math.max(0, player.hp - amount);
  player.action = "hit";
  player.actionTimer = 0.28;
  player.invuln = 0.45;
  state.shake = 8;
}

function endGame(message) {
  running = false;
  state.mode = "done";
  state.message = message;
  saveScore(message === "Winner");
  renderScores();
  startPanel.querySelector("h1").textContent = message;
  startPanel.querySelector("p").textContent = "Score saved locally. Enter a username and start again.";
  startPanel.classList.remove("is-hidden");
}

function saveScore(winner) {
  const scores = readScores();
  scores.push({
    name: playerName,
    score: Math.round(state.score),
    wave: state.wave,
    winner,
    date: new Date().toISOString()
  });
  scores.sort((a, b) => b.score - a.score);
  localStorage.setItem(SCORE_KEY, JSON.stringify(scores.slice(0, 10)));
}

function readScores() {
  try {
    return JSON.parse(localStorage.getItem(SCORE_KEY)) || [];
  } catch {
    return [];
  }
}

function renderScores() {
  const scores = readScores();
  scoreList.innerHTML = "";
  if (scores.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = "No runs yet";
    scoreList.appendChild(empty);
    return;
  }
  for (const score of scores) {
    const item = document.createElement("li");
    item.innerHTML = `<strong>${escapeHtml(score.name)}</strong><br>${score.score} pts ${score.winner ? "Winner" : "Wave " + score.wave}`;
    scoreList.appendChild(item);
  }
}

function draw() {
  ctx.save();
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  if (state.shake > 0) {
    ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
  }

  drawBackground();
  drawFloorGlow();

  const drawables = [state.player, ...state.enemies].sort((a, b) => a.y - b.y);
  for (const item of drawables) {
    if (item === state.player) drawPlayer(item);
    else drawEnemy(item);
  }

  drawEnemyBars();
  drawOverlayMessage();
  ctx.restore();
}

function drawBackground() {
  const img = assets.background;
  if (!img.complete) return;
  ctx.drawImage(img, 0, 0, WIDTH, HEIGHT);
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, "rgba(1, 8, 4, 0.12)");
  gradient.addColorStop(0.72, "rgba(1, 8, 4, 0.02)");
  gradient.addColorStop(1, "rgba(1, 3, 2, 0.38)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

function drawFloorGlow() {
  ctx.fillStyle = "rgba(3, 28, 13, 0.18)";
  ctx.fillRect(0, GROUND_TOP + 28, WIDTH, GROUND_BOTTOM - GROUND_TOP);
}

function drawPlayer(player) {
  const frame = { idle: 0, walk: 1, punch: 2, kick: 3, hit: 4 }[player.action] || 0;
  const sheet = assets.robinman;
  if (!sheet.complete) return;
  const sw = sheet.width / 5;
  const sh = sheet.height;
  const dw = player.w * 1.38;
  const dh = player.h * 1.38;
  const dx = player.x - 26;
  const dy = player.y - dh + 106;

  ctx.save();
  if (player.invuln > 0 && Math.floor(performance.now() / 70) % 2 === 0) {
    ctx.globalAlpha = 0.48;
  }
  if (player.facing === -1) {
    ctx.translate(dx + dw, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(sheet, sw * frame, 0, sw, sh, 0, 0, dw, dh);
  } else {
    ctx.drawImage(sheet, sw * frame, 0, sw, sh, dx, dy, dw, dh);
  }
  ctx.restore();
}

function drawEnemy(enemy) {
  ctx.save();
  if (enemy.hitTimer > 0) ctx.filter = "brightness(1.8)";

  if (enemy.kind === "boss") {
    const img = assets.boss;
    if (img.complete) {
      const dw = enemy.w * 1.55;
      const dh = enemy.h * 1.55;
      ctx.drawImage(img, 0, 0, img.width, img.height, enemy.x - 84, enemy.y - dh + 130, dw, dh);
    }
  } else {
    const sheet = assets.villains;
    if (sheet.complete) {
      const sw = sheet.width / 3;
      const sh = sheet.height;
      const dw = enemy.w * 1.72;
      const dh = enemy.h * 1.72;
      ctx.drawImage(sheet, enemy.frame * sw, 0, sw, sh, enemy.x - 50, enemy.y - dh + 110, dw, dh);
    }
  }

  ctx.restore();
}

function drawEnemyBars() {
  for (const enemy of state.enemies) {
    const box = enemyBox(enemy);
    const pct = clamp(enemy.hp / enemy.maxHp, 0, 1);
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(box.x, box.y - 16, box.w, 6);
    ctx.fillStyle = enemy.kind === "boss" ? "#f3eed9" : "#79f1a8";
    ctx.fillRect(box.x, box.y - 16, box.w * pct, 6);
  }
}

function drawOverlayMessage() {
  if (state.mode !== "playing") return;
  if (state.wave === 4 && state.bossSpawned) {
    ctx.fillStyle = "rgba(243, 238, 217, 0.92)";
    ctx.font = "800 28px Cinzel, serif";
    ctx.fillText("Final Boss", 52, 92);
  }
}

function updateHud() {
  scoreText.textContent = `Score ${Math.round(state.score)}`;
  waveText.textContent = state.wave === 4 ? "Boss" : `Wave ${state.wave}`;
  healthText.textContent = `HP ${Math.round(state.player.hp)}`;
}

function enemyBox(enemy) {
  return {
    x: enemy.x + enemy.w * 0.12,
    y: enemy.y - enemy.h + 86,
    w: enemy.w * 0.76,
    h: enemy.h
  };
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  })[char]);
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "j", "k"].includes(key)) {
    event.preventDefault();
  }
  keys.add(key);
  if (key === "j") playerAttack("punch");
  if (key === "k") playerAttack("kick");
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

playerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = playerNameInput.value.trim().replace(/\s+/g, " ").slice(0, 18);
  startGame(name || "player");
});

resetScores.addEventListener("click", () => {
  localStorage.removeItem(SCORE_KEY);
  renderScores();
});

Promise.all(Object.values(assets).map((img) => new Promise((resolve) => {
  if (img.complete) resolve();
  else img.addEventListener("load", resolve, { once: true });
}))).then(() => {
  updateHud();
  renderScores();
  draw();
});
