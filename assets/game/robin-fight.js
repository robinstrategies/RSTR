const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreText = document.getElementById("scoreText");
const waveText = document.getElementById("waveText");
const healthText = document.getElementById("healthText");
const healthFill = document.getElementById("healthFill");
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
  robinman: loadImage("../assets/game/robinman-player-clean.png"),
  villains: loadImage("../assets/game/villains-sheet-clean.png"),
  boss: loadImage("../assets/game/boss-v2.png")
};

const keys = new Set();
const params = new URLSearchParams(window.location.search);
let playerName = "player";
let state = createState();
let lastTime = 0;
let running = false;
let agentTimer = 0;
let agentTick = 0;

const waves = [
  { count: 5, tiers: [0, 0, 1, 0, 1] },
  { count: 7, tiers: [0, 1, 2, 1, 2, 0, 2] },
  { count: 9, tiers: [1, 2, 3, 1, 2, 3, 2, 3, 1] },
  { count: 10, tiers: [2, 3, 4, 2, 3, 4, 1, 4, 3, 4] }
];

const tierStats = [
  { hp: 32, speed: 92, damage: 8, score: 120, frame: 0 },
  { hp: 54, speed: 82, damage: 12, score: 210, frame: 1 },
  { hp: 82, speed: 66, damage: 17, score: 330, frame: 2 },
  { hp: 108, speed: 122, damage: 22, score: 520, frame: 3 },
  { hp: 152, speed: 74, damage: 30, score: 820, frame: 4 }
];

const itemTypes = [
  { type: "heart", label: "+14 HP", weight: 0.34 },
  { type: "immunity", label: "IMMUNE", weight: 0.16 },
  { type: "bomb", label: "-22 HP", weight: 0.5 }
];

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
    spawnedInWave: 0,
    bossSpawned: false,
    popups: [],
    items: [],
    player: {
      x: 160,
      y: 548,
      w: 150,
      h: 226,
      speed: 284,
      hp: 100,
      maxHp: 100,
      facing: 1,
      action: "idle",
      actionTimer: 0,
      invuln: 0,
      immuneTimer: 0,
      defending: false
    },
    enemies: []
  };
}

function startGame(name) {
  playerName = name || "player";
  state = createState();
  state.mode = "playing";
  startPanel.querySelector("h1").textContent = "Robinman Alley Fight";
  startPanel.querySelector("p").textContent = "Move with arrows or WASD. Punch with J. Kick with K. Hold Shift or L to defend.";
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
    y: GROUND_TOP + 74 + Math.random() * 112,
    w: 118 + tier * 18,
    h: 174 + tier * 17,
    hp: stats.hp,
    maxHp: stats.hp,
    speed: stats.speed,
    damage: stats.damage,
    score: stats.score,
    frame: stats.frame,
    hitTimer: 0,
    attackTimer: 0.5 + Math.random() * 0.7,
    defendTimer: 0,
    defendCooldown: 0.6 + Math.random() * 1.4,
    attackAnim: 0,
    kind: "enemy"
  });
}

function spawnBoss() {
  state.bossSpawned = true;
  state.enemies.push({
    tier: 5,
    x: WIDTH + 160,
    y: 496,
    w: 235,
    h: 310,
    hp: 520,
    maxHp: 520,
    speed: 58,
    damage: 36,
    score: 1800,
    frame: 0,
    hitTimer: 0,
    attackTimer: 0.6,
    defendTimer: 0,
    defendCooldown: 1.1,
    attackAnim: 0,
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
  updateItems(dt);
  updatePopups(dt);

  state.enemies = state.enemies.filter((enemy) => {
    if (enemy.hp > 0) return true;
    scoreKill(enemy);
    return false;
  });

  if (state.player.hp <= 0) endGame("Game over");

  if (state.wave === 5 && state.bossSpawned && state.enemies.length === 0) {
    state.score += Math.max(0, Math.round(state.player.hp)) * 8;
    addPopup("HP BONUS", state.player.x + 20, state.player.y - 170, "#f3eed9");
    endGame("Winner");
  }

  state.shake = Math.max(0, state.shake - dt * 18);
  updateHud();
}

function updatePlayer(dt) {
  const player = state.player;
  const defending = keys.has("shift") || keys.has("l");
  let dx = 0;
  let dy = 0;

  player.defending = defending && player.actionTimer <= 0.08;
  if (player.defending) {
    player.action = "defend";
  }

  if (!player.defending) {
    if (keys.has("arrowleft") || keys.has("a")) dx -= 1;
    if (keys.has("arrowright") || keys.has("d")) dx += 1;
    if (keys.has("arrowup") || keys.has("w")) dy -= 1;
    if (keys.has("arrowdown") || keys.has("s")) dy += 1;
  }

  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy);
    dx /= len;
    dy /= len;
    player.x += dx * player.speed * dt;
    player.y += dy * player.speed * dt;
    player.action = player.actionTimer > 0 ? player.action : "walk";
    player.facing = dx < 0 ? -1 : dx > 0 ? 1 : player.facing;
  } else if (player.actionTimer <= 0 && !player.defending) {
    player.action = "idle";
  }

  player.x = clamp(player.x, 20, WIDTH - player.w - 20);
  player.y = clamp(player.y, GROUND_TOP, GROUND_BOTTOM - 56);
  player.actionTimer = Math.max(0, player.actionTimer - dt);
  player.invuln = Math.max(0, player.invuln - dt);
  player.immuneTimer = Math.max(0, player.immuneTimer - dt);
}

function updateWave(dt) {
  const liveRegulars = state.enemies.filter((enemy) => enemy.kind === "enemy").length;

  if (state.wave <= waves.length) {
    const wave = waves[state.wave - 1];
    state.spawnTimer -= dt;
    if (state.spawnedInWave < wave.count && liveRegulars < 4 && state.spawnTimer <= 0) {
      const tier = wave.tiers[state.spawnedInWave % wave.tiers.length];
      spawnEnemy(tier);
      state.spawnedInWave += 1;
      state.spawnTimer = 0.75;
    }
    if (state.spawnedInWave >= wave.count && state.enemies.length === 0) {
      state.wave += 1;
      state.spawnedInWave = 0;
      state.spawnTimer = 0.8;
      state.score += 250;
      addPopup("+250 WAVE", WIDTH / 2 - 60, 120, "#f3eed9");
    }
    return;
  }

  if (!state.bossSpawned && state.enemies.length === 0) spawnBoss();
}

function updateEnemies(dt) {
  for (const enemy of state.enemies) {
    enemy.hitTimer = Math.max(0, enemy.hitTimer - dt);
    enemy.attackTimer = Math.max(0, enemy.attackTimer - dt);
    enemy.defendTimer = Math.max(0, enemy.defendTimer - dt);
    enemy.defendCooldown = Math.max(0, enemy.defendCooldown - dt);
    enemy.attackAnim = Math.max(0, enemy.attackAnim - dt);

    const player = state.player;
    const distX = player.x + player.w * 0.5 - (enemy.x + enemy.w * 0.5);
    const distY = player.y - enemy.y;
    const range = enemy.kind === "boss" ? 150 : 108 + enemy.tier * 6;
    const mayDefend = enemy.defendCooldown <= 0 && Math.abs(distX) < 210 && Math.abs(distY) < 82;

    if (mayDefend && Math.random() < (enemy.kind === "boss" ? 0.025 : 0.012 + enemy.tier * 0.004)) {
      enemy.defendTimer = enemy.kind === "boss" ? 0.72 : 0.48 + enemy.tier * 0.05;
      enemy.defendCooldown = enemy.kind === "boss" ? 1.3 : 1.6;
    }

    if (enemy.defendTimer <= 0) {
      if (Math.abs(distX) > range) enemy.x += Math.sign(distX) * enemy.speed * dt;
      if (Math.abs(distY) > 8) enemy.y += Math.sign(distY) * enemy.speed * 0.58 * dt;
    }

    enemy.y = clamp(enemy.y, GROUND_TOP, GROUND_BOTTOM - 56);

    if (Math.abs(distX) < range && Math.abs(distY) < 68 && enemy.attackTimer <= 0 && enemy.defendTimer <= 0) {
      enemy.attackAnim = 0.22;
      damagePlayer(enemy.damage, enemy);
      enemy.attackTimer = enemy.kind === "boss" ? 0.72 : Math.max(0.55, 0.95 - enemy.tier * 0.06);
    }
  }
}

function updateItems(dt) {
  const playerBox = {
    x: state.player.x + 20,
    y: state.player.y - 126,
    w: state.player.w - 40,
    h: 128
  };

  for (const item of state.items) {
    item.life -= dt;
    item.float += dt;
    if (!item.collected && rectsOverlap(playerBox, itemBox(item))) collectItem(item);
  }

  state.items = state.items.filter((item) => item.life > 0 && !item.collected);
}

function updatePopups(dt) {
  for (const popup of state.popups) {
    popup.life -= dt;
    popup.y -= dt * 42;
  }
  state.popups = state.popups.filter((popup) => popup.life > 0);
}

function playerAttack(kind) {
  const player = state.player;
  if (state.mode !== "playing" || player.actionTimer > 0.08 || player.defending) return;

  const isKick = kind === "kick";
  player.action = isKick ? "kick" : "punch";
  player.actionTimer = isKick ? 0.32 : 0.24;

  const reach = isKick ? 190 : 152;
  const damage = isKick ? 28 : 20;
  const start = player.facing === 1 ? player.x + player.w * 0.48 : player.x - reach;
  const hitbox = {
    x: start,
    y: player.y - 126,
    w: reach,
    h: 136
  };

  let landed = false;
  for (const enemy of state.enemies) {
    if (rectsOverlap(hitbox, enemyBox(enemy))) {
      const blocked = enemy.defendTimer > 0;
      const dealt = blocked ? Math.ceil(damage * 0.28) : damage;
      enemy.hp -= dealt;
      enemy.hitTimer = blocked ? 0.08 : 0.18;
      enemy.x += player.facing * (blocked ? 10 : isKick ? 34 : 20);
      state.score += enemy.hp <= 0 ? 0 : blocked ? 6 : 18;
      state.shake = Math.max(state.shake, blocked ? 2 : isKick ? 5 : 3);
      addPopup(blocked ? "BLOCK" : `-${dealt}`, enemy.x, enemy.y - enemy.h + 70, blocked ? "#d7f7b4" : "#79f1a8");
      landed = true;
    }
  }

  if (!landed) state.score = Math.max(0, state.score - 2);
}

function damagePlayer(amount, enemy) {
  const player = state.player;
  if (player.invuln > 0 || player.immuneTimer > 0) {
    addPopup("IMMUNE", player.x + 20, player.y - 156, "#f3eed9");
    return;
  }

  const blocked = player.defending;
  const damage = blocked ? Math.ceil(amount * 0.25) : amount;
  player.hp = Math.max(0, player.hp - damage);
  player.action = blocked ? "defend" : "hit";
  player.actionTimer = blocked ? 0.12 : 0.28;
  player.invuln = blocked ? 0.22 : 0.45;
  state.shake = blocked ? 3 : 8;
  addPopup(blocked ? "GUARD" : `-${damage} HP`, player.x + 10, player.y - 158, blocked ? "#d7f7b4" : "#f3eed9");

  if (blocked && enemy) {
    enemy.x += Math.sign(enemy.x - player.x) * 16;
  }
}

function scoreKill(enemy) {
  if (enemy.counted) return;
  enemy.counted = true;
  state.score += enemy.score;
  addPopup(`+${enemy.score}`, enemy.x + 8, enemy.y - enemy.h + 58, "#f3eed9");
  maybeDropItem(enemy);
}

function maybeDropItem(enemy) {
  const chance = enemy.kind === "boss" ? 1 : 0.32;
  if (Math.random() > chance) return;
  const pick = weightedPick(itemTypes);
  state.items.push({
    type: pick.type,
    label: pick.label,
    x: clamp(enemy.x + enemy.w * 0.35, 40, WIDTH - 80),
    y: enemy.y - 28,
    life: 4,
    float: 0,
    collected: false
  });
}

function collectItem(item) {
  item.collected = true;
  if (item.type === "heart") {
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + 14);
    addPopup("+14 HP", item.x - 16, item.y - 32, "#ff6f91");
  } else if (item.type === "immunity") {
    state.player.immuneTimer = 3.5;
    addPopup("IMMUNE", item.x - 22, item.y - 32, "#f3eed9");
  } else {
    damagePlayer(22);
    addPopup("BOMB", item.x - 10, item.y - 32, "#ffcf5f");
  }
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
  drawItems();

  const drawables = [state.player, ...state.enemies].sort((a, b) => a.y - b.y);
  for (const item of drawables) {
    if (item === state.player) drawPlayer(item);
    else drawEnemy(item);
  }

  drawEnemyBars();
  drawPopups();
  drawOverlayMessage();
  ctx.restore();
}

function drawBackground() {
  const img = assets.background;
  if (!img.complete) return;
  ctx.imageSmoothingEnabled = true;
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
  const frame = { idle: 0, walk: 1, punch: 2, kick: 3, hit: 0, defend: 4 }[player.action] || 0;
  const sheet = assets.robinman;
  if (!sheet.complete) return;
  const sw = sheet.width / 5;
  const sh = sheet.height;
  const dw = player.w * 1.58;
  const dh = player.h * 1.58;
  const bob = player.action === "walk" ? Math.sin(performance.now() / 95) * 4 : 0;
  const lunge = player.action === "punch" ? 18 : player.action === "kick" ? 24 : 0;
  const dx = player.x - 44 + player.facing * lunge;
  const dy = player.y - dh + 122 + bob;

  ctx.save();
  if (player.invuln > 0 && Math.floor(performance.now() / 70) % 2 === 0) ctx.globalAlpha = 0.48;
  if (player.facing === -1) {
    ctx.translate(dx + dw, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(sheet, sw * frame, 0, sw, sh, 0, 0, dw, dh);
  } else {
    ctx.drawImage(sheet, sw * frame, 0, sw, sh, dx, dy, dw, dh);
  }

  if (player.defending || player.immuneTimer > 0) {
    drawGuardArc(player.x + player.w * 0.52, player.y - 112, player.immuneTimer > 0 ? "#f3eed9" : "#79f1a8", player.immuneTimer > 0 ? 0.46 : 0.28);
  }
  ctx.restore();
}

function drawEnemy(enemy) {
  ctx.save();
  if (enemy.hitTimer > 0) ctx.filter = "brightness(1.8)";
  const attackLunge = enemy.attackAnim > 0 ? -18 * Math.sin((enemy.attackAnim / 0.22) * Math.PI) : 0;
  const defendLean = enemy.defendTimer > 0 ? 0.92 : 1;
  const bob = enemy.defendTimer > 0 ? 0 : Math.sin(performance.now() / (120 - Math.min(enemy.tier, 4) * 8) + enemy.x) * 2.6;

  if (enemy.kind === "boss") {
    const img = assets.boss;
    if (img.complete) {
      const dw = enemy.w * 1.6;
      const dh = enemy.h * 1.6;
      ctx.translate(enemy.x - 92 + attackLunge, enemy.y - dh + 138 + bob);
      ctx.scale(defendLean, 1);
      ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, dw, dh);
    }
  } else {
    const sheet = assets.villains;
    if (sheet.complete) {
      const sw = sheet.width / 5;
      const sh = sheet.height;
      const dw = enemy.w * 1.74;
      const dh = enemy.h * 1.74;
      ctx.translate(enemy.x - 50 + attackLunge, enemy.y - dh + 110 + bob);
      ctx.scale(defendLean, 1);
      ctx.drawImage(sheet, enemy.frame * sw, 0, sw, sh, 0, 0, dw, dh);
    }
  }

  ctx.restore();
  if (enemy.defendTimer > 0) drawGuardArc(enemy.x + enemy.w * 0.43, enemy.y - enemy.h * 0.5, "#d7f7b4", 0.22);
}

function drawEnemyBars() {
  for (const enemy of state.enemies) {
    const box = enemyBox(enemy);
    const pct = clamp(enemy.hp / enemy.maxHp, 0, 1);
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(box.x, box.y - 16, box.w, 6);
    ctx.fillStyle = enemy.kind === "boss" ? "#f3eed9" : "#79f1a8";
    ctx.fillRect(box.x, box.y - 16, box.w * pct, 6);
    ctx.fillStyle = "rgba(243, 238, 217, 0.82)";
    ctx.font = "700 11px Inter, sans-serif";
    ctx.fillText(`+${enemy.score}`, box.x, box.y - 22);
  }
}

function drawItems() {
  for (const item of state.items) {
    if (item.life <= 2 && Math.floor(item.life * 8) % 2 === 0) continue;
    const y = item.y + Math.sin(item.float * 7) * 4;
    ctx.save();
    ctx.shadowColor = "rgba(121, 241, 168, 0.6)";
    ctx.shadowBlur = 12;
    if (item.type === "heart") drawHeart(item.x, y);
    if (item.type === "immunity") drawStarOfDavid(item.x, y);
    if (item.type === "bomb") drawBomb(item.x, y);
    ctx.restore();
  }
}

function drawPopups() {
  for (const popup of state.popups) {
    ctx.save();
    ctx.globalAlpha = clamp(popup.life / 0.9, 0, 1);
    ctx.fillStyle = popup.color;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.78)";
    ctx.lineWidth = 4;
    ctx.font = "900 24px Inter, sans-serif";
    ctx.strokeText(popup.text, popup.x, popup.y);
    ctx.fillText(popup.text, popup.x, popup.y);
    ctx.restore();
  }
}

function drawOverlayMessage() {
  if (state.mode !== "playing") return;
  if (state.wave === 5 && state.bossSpawned) {
    ctx.fillStyle = "rgba(243, 238, 217, 0.92)";
    ctx.font = "800 28px Cinzel, serif";
    ctx.fillText("Final Boss", 52, 92);
  }
  if (state.player.immuneTimer > 0) {
    ctx.fillStyle = "rgba(243, 238, 217, 0.92)";
    ctx.font = "800 18px Inter, sans-serif";
    ctx.fillText(`Immunity ${state.player.immuneTimer.toFixed(1)}s`, 52, 122);
  }
}

function drawGuardArc(x, y, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(x, y, 58, -1.15, 1.15);
  ctx.stroke();
  ctx.restore();
}

function drawHeart(x, y) {
  ctx.fillStyle = "#ff5f88";
  ctx.beginPath();
  ctx.moveTo(x, y + 14);
  ctx.bezierCurveTo(x - 34, y - 8, x - 16, y - 34, x, y - 16);
  ctx.bezierCurveTo(x + 16, y - 34, x + 34, y - 8, x, y + 14);
  ctx.fill();
}

function drawStarOfDavid(x, y) {
  ctx.strokeStyle = "#f3eed9";
  ctx.lineWidth = 5;
  drawTriangle(x, y - 4, 24, -Math.PI / 2);
  drawTriangle(x, y + 4, 24, Math.PI / 2);
}

function drawTriangle(x, y, radius, rotation) {
  ctx.beginPath();
  for (let i = 0; i < 3; i += 1) {
    const angle = rotation + i * (Math.PI * 2 / 3);
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();
}

function drawBomb(x, y) {
  ctx.fillStyle = "#1a1c18";
  ctx.beginPath();
  ctx.arc(x, y, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ffcf5f";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x + 12, y - 16);
  ctx.quadraticCurveTo(x + 24, y - 32, x + 34, y - 20);
  ctx.stroke();
  ctx.fillStyle = "#ffcf5f";
  ctx.beginPath();
  ctx.arc(x + 36, y - 18, 5, 0, Math.PI * 2);
  ctx.fill();
}

function updateHud() {
  const hpPct = clamp(state.player.hp / state.player.maxHp, 0, 1);
  scoreText.textContent = `Score ${Math.round(state.score)}`;
  waveText.textContent = state.wave === 5 ? "Boss" : `Wave ${state.wave}`;
  healthText.textContent = `HP ${Math.round(state.player.hp)}`;
  healthFill.style.width = `${hpPct * 100}%`;
  healthFill.style.background = hpPct < 0.28
    ? "linear-gradient(90deg, #ff6f66, #ffcf5f)"
    : "linear-gradient(90deg, #d7f7b4, #35c96c)";
}

function enemyBox(enemy) {
  return {
    x: enemy.x + enemy.w * 0.12,
    y: enemy.y - enemy.h + 86,
    w: enemy.w * 0.76,
    h: enemy.h
  };
}

function itemBox(item) {
  return {
    x: item.x - 28,
    y: item.y - 34,
    w: 56,
    h: 56
  };
}

function addPopup(text, x, y, color) {
  state.popups.push({ text, x, y, color, life: 0.9 });
}

function weightedPick(items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return items[0];
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

function getSnapshot() {
  return {
    mode: state.mode,
    message: state.message,
    score: Math.round(state.score),
    wave: state.wave,
    bossSpawned: state.bossSpawned,
    running,
    player: {
      x: Math.round(state.player.x),
      y: Math.round(state.player.y),
      hp: Math.round(state.player.hp),
      maxHp: state.player.maxHp,
      facing: state.player.facing,
      action: state.player.action,
      defending: state.player.defending,
      immuneTimer: Number(state.player.immuneTimer.toFixed(2))
    },
    enemies: state.enemies.map((enemy) => ({
      id: enemy.id || `${enemy.kind}-${enemy.tier}-${Math.round(enemy.x)}-${Math.round(enemy.y)}`,
      kind: enemy.kind,
      tier: enemy.tier,
      x: Math.round(enemy.x),
      y: Math.round(enemy.y),
      hp: Math.round(enemy.hp),
      maxHp: enemy.maxHp,
      score: enemy.score,
      defending: enemy.defendTimer > 0,
      attacking: enemy.attackAnim > 0
    })),
    items: state.items.map((item) => ({
      type: item.type,
      x: Math.round(item.x),
      y: Math.round(item.y),
      life: Number(item.life.toFixed(2))
    }))
  };
}

function clearAgentKeys() {
  for (const key of ["arrowleft", "arrowright", "arrowup", "arrowdown", "a", "d", "w", "s", "shift", "l"]) {
    keys.delete(key);
  }
}

function applyAction(action = {}) {
  if (action.start || state.mode !== "playing") {
    startGame(action.name || playerName || "Agent");
    return getSnapshot();
  }

  clearAgentKeys();
  if (action.left) keys.add("arrowleft");
  if (action.right) keys.add("arrowright");
  if (action.up) keys.add("arrowup");
  if (action.down) keys.add("arrowdown");
  if (action.defend) keys.add("shift");
  if (action.left) state.player.facing = -1;
  if (action.right) state.player.facing = 1;
  if (action.punch) playerAttack("punch");
  if (action.kick) playerAttack("kick");
  return getSnapshot();
}

function chooseAgentAction(snapshot = getSnapshot()) {
  if (snapshot.mode !== "playing") return { start: true, name: params.get("name") || "Agent" };

  const player = snapshot.player;
  const goodItems = snapshot.items
    .filter((item) => item.x >= 40 && item.x <= WIDTH - 80)
    .filter((item) => item.type !== "bomb" && (item.type !== "heart" || player.hp < player.maxHp - 8))
    .sort((a, b) => distance(player, a) - distance(player, b));
  const dangerousBomb = snapshot.items.find((item) => item.x >= 40 && item.x <= WIDTH - 80 && item.type === "bomb" && Math.abs(item.x - player.x) < 70 && Math.abs(item.y - player.y) < 70);

  if (dangerousBomb) {
    return {
      left: dangerousBomb.x >= player.x,
      right: dangerousBomb.x < player.x,
      up: dangerousBomb.y >= player.y,
      down: dangerousBomb.y < player.y
    };
  }

  if (goodItems[0] && goodItems[0].life > 0.45 && distance(player, goodItems[0]) < 280) {
    return moveToward(player, goodItems[0], 18);
  }

  const target = snapshot.enemies
    .slice()
    .sort((a, b) => Math.abs(a.x - player.x) + Math.abs(a.y - player.y) - (Math.abs(b.x - player.x) + Math.abs(b.y - player.y)))[0];

  if (!target) return { right: player.x < 440, down: player.y < 540, up: player.y > 570 };

  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const close = Math.abs(dx) < 285 && Math.abs(dy) < 68;
  const threatened = close && (target.attacking || player.hp < 30);
  const face = { left: dx < -10, right: dx > 10 };

  if (threatened && agentTick % 3 === 0) return { defend: true };
  if (!close) return moveToward(player, target, 92);
  return agentTick % 4 === 0 ? { ...face, kick: true } : { ...face, punch: true };
}

function moveToward(from, to, tolerance) {
  return {
    left: to.x < from.x - tolerance,
    right: to.x > from.x + tolerance,
    up: to.y < from.y - 16,
    down: to.y > from.y + 16
  };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

async function requestAgentAction(snapshot) {
  const endpoint = params.get("agentApi");
  if (!endpoint) return chooseAgentAction(snapshot);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snapshot })
    });
    if (!response.ok) return chooseAgentAction(snapshot);
    const payload = await response.json();
    return payload.action || chooseAgentAction(snapshot);
  } catch {
    return chooseAgentAction(snapshot);
  }
}

function setAgentMode(enabled, options = {}) {
  window.clearInterval(agentTimer);
  if (!enabled) {
    clearAgentKeys();
    agentTimer = 0;
    return;
  }
  const delay = options.delay || 90;
  const loopRuns = options.loop !== false;
  agentTimer = window.setInterval(async () => {
    agentTick += 1;
    const snapshot = getSnapshot();
    if (snapshot.mode !== "playing" && !loopRuns && snapshot.mode !== "ready") return;
    const action = await requestAgentAction(snapshot);
    applyAction(action);
  }, delay);
}

function stepForTest(action = {}, dt = 0.033) {
  applyAction(action);
  update(dt);
  draw();
  return getSnapshot();
}

window.RobinFight = {
  snapshot: getSnapshot,
  applyAction,
  chooseAgentAction,
  setAgentMode,
  stepForTest,
  start: startGame,
  stop: () => setAgentMode(false)
};

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "j", "k", "l", "shift"].includes(key)) {
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
  if (params.get("agent") === "1" || params.get("bot") === "1") {
    playerNameInput.value = params.get("name") || "Agent";
    setAgentMode(true, { loop: params.get("loop") !== "0" });
  }
});
