const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreText = document.getElementById("scoreText");
const waveText = document.getElementById("waveText");
const healthText = document.getElementById("healthText");
const healthFill = document.getElementById("healthFill");
const startPanel = document.getElementById("startPanel");
const playerForm = document.getElementById("playerForm");
const playerNameInput = document.getElementById("playerName");
const scoreboardTitle = document.getElementById("scoreboardTitle");
const scoreboardStatus = document.getElementById("scoreboardStatus");
const scoreList = document.getElementById("scoreList");
const resetScores = document.getElementById("resetScores");
const musicToggle = document.getElementById("musicToggle");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const GROUND_TOP = 420;
const GROUND_BOTTOM = 646;
const SCORE_KEY = "robinman-alley-fight-scores";
const MUSIC_KEY = "robinman-byte-fighter-music";
const LEADERBOARD_RPC = "get_robin_fight_leaderboard";
const SUBMIT_SCORE_FUNCTION = "submit-robin-score";

const assets = {
  background: loadImage("../assets/game/alley-stage.png"),
  robinman: loadImage("../assets/game/robinman-player-clean.png"),
  villains: loadImage("../assets/game/villains-bear-market.png"),
  bear: loadImage("../assets/game/bear-market-brute.png"),
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
let audioContext = null;
let masterGain = null;
let musicGain = null;
let sfxGain = null;
let musicTimer = 0;
let musicStep = 0;
let musicEnabled = localStorage.getItem(MUSIC_KEY) !== "0";
let gameStartTime = 0;
let supabaseClient = null;
let remoteScores = [];
let remoteScoresReady = false;

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

const bearStats = {
  hp: 230,
  speed: 52,
  damage: 32,
  score: 960
};

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
    bearTimer: 7,
    bearsInWave: 0,
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
  gameStartTime = performance.now();
  startPanel.querySelector("h1").textContent = "Robinman Alley Fight";
  startPanel.querySelector("p").textContent = "Move with arrows or WASD. Punch with J. Kick with K. Hold Shift or L to defend.";
  startPanel.classList.add("is-hidden");
  running = true;
  lastTime = performance.now();
  requestAnimationFrame(loop);
  if (musicEnabled) startMusic();
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
    walkCycle: Math.random() * Math.PI * 2,
    facing: -1,
    action: "idle",
    kind: "enemy"
  });
}

function spawnBear() {
  state.bearsInWave += 1;
  state.enemies.push({
    tier: 6,
    x: WIDTH + 220,
    y: GROUND_TOP + 118 + Math.random() * 72,
    w: 250,
    h: 324,
    hp: bearStats.hp,
    maxHp: bearStats.hp,
    speed: bearStats.speed,
    damage: bearStats.damage,
    score: bearStats.score,
    frame: 0,
    hitTimer: 0,
    attackTimer: 0.8,
    defendTimer: 0,
    defendCooldown: 1.8,
    attackAnim: 0,
    walkCycle: Math.random() * Math.PI * 2,
    facing: -1,
    action: "idle",
    kind: "bear"
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
    walkCycle: 0,
    facing: -1,
    action: "idle",
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
    const liveBears = state.enemies.filter((enemy) => enemy.kind === "bear").length;
    state.spawnTimer -= dt;
    if (state.spawnedInWave < wave.count && liveRegulars < 4 && state.spawnTimer <= 0) {
      const tier = wave.tiers[state.spawnedInWave % wave.tiers.length];
      spawnEnemy(tier);
      state.spawnedInWave += 1;
      state.spawnTimer = 0.75;
    }
    if (state.wave >= 2 && state.spawnedInWave > 1 && liveBears === 0 && state.bearsInWave < (state.wave >= 4 ? 2 : 1)) {
      state.bearTimer -= dt;
      if (state.bearTimer <= 0) {
        if (Math.random() < 0.58) spawnBear();
        state.bearTimer = 7 + Math.random() * 6;
      }
    }
    if (state.spawnedInWave >= wave.count && state.enemies.length === 0) {
      state.wave += 1;
      state.spawnedInWave = 0;
      state.spawnTimer = 0.8;
      state.bearTimer = 5 + Math.random() * 5;
      state.bearsInWave = 0;
      state.score += 250;
      addPopup("+250 WAVE", WIDTH / 2 - 60, 120, "#f3eed9");
      playSfx("wave");
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
    enemy.action = enemy.hitTimer > 0 ? "hit" : "idle";

    const player = state.player;
    const distX = player.x + player.w * 0.5 - (enemy.x + enemy.w * 0.5);
    const distY = player.y - enemy.y;
    enemy.facing = distX < 0 ? -1 : 1;
    const range = enemy.kind === "boss" ? 150 : enemy.kind === "bear" ? 172 : 108 + enemy.tier * 6;
    const mayDefend = enemy.defendCooldown <= 0 && Math.abs(distX) < 210 && Math.abs(distY) < 82;

    if (mayDefend && Math.random() < (enemy.kind === "boss" ? 0.025 : enemy.kind === "bear" ? 0.02 : 0.012 + enemy.tier * 0.004)) {
      enemy.defendTimer = enemy.kind === "boss" ? 0.72 : enemy.kind === "bear" ? 0.64 : 0.48 + enemy.tier * 0.05;
      enemy.defendCooldown = enemy.kind === "boss" ? 1.3 : enemy.kind === "bear" ? 1.9 : 1.6;
    }

    let moved = false;
    if (enemy.defendTimer <= 0) {
      if (Math.abs(distX) > range) {
        enemy.x += Math.sign(distX) * enemy.speed * dt;
        moved = true;
      }
      if (Math.abs(distY) > 8) {
        enemy.y += Math.sign(distY) * enemy.speed * 0.58 * dt;
        moved = true;
      }
    }

    enemy.y = clamp(enemy.y, GROUND_TOP, GROUND_BOTTOM - 56);

    if (Math.abs(distX) < range && Math.abs(distY) < 68 && enemy.attackTimer <= 0 && enemy.defendTimer <= 0) {
      enemy.attackAnim = enemy.kind === "bear" ? 0.34 : 0.22;
      enemy.action = "attack";
      damagePlayer(enemy.damage, enemy);
      enemy.attackTimer = enemy.kind === "boss" ? 0.72 : enemy.kind === "bear" ? 1.05 : Math.max(0.55, 0.95 - enemy.tier * 0.06);
    } else if (enemy.defendTimer > 0) {
      enemy.action = "defend";
    } else if (moved) {
      enemy.action = "walk";
      enemy.walkCycle += dt * (enemy.speed / 18);
    } else if (enemy.attackAnim > 0) {
      enemy.action = "attack";
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
      playSfx(blocked ? "block" : isKick ? "kick" : "punch");
      landed = true;
    }
  }

  if (!landed) {
    state.score = Math.max(0, state.score - 2);
    playSfx("miss");
  }
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
  playSfx(blocked ? "guard" : "hurt");

  if (blocked && enemy) {
    enemy.x += Math.sign(enemy.x - player.x) * 16;
  }
}

function scoreKill(enemy) {
  if (enemy.counted) return;
  enemy.counted = true;
  state.score += enemy.score;
  addPopup(`+${enemy.score}`, enemy.x + 8, enemy.y - enemy.h + 58, "#f3eed9");
  playSfx(enemy.kind === "boss" ? "bossDown" : "ko");
  maybeDropItem(enemy);
}

function maybeDropItem(enemy) {
  const chance = enemy.kind === "boss" ? 1 : enemy.kind === "bear" ? 0.52 : 0.32;
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
    playSfx("heart");
  } else if (item.type === "immunity") {
    state.player.immuneTimer = 3.5;
    addPopup("IMMUNE", item.x - 22, item.y - 32, "#f3eed9");
    playSfx("immunity");
  } else {
    damagePlayer(22);
    addPopup("BOMB", item.x - 10, item.y - 32, "#ffcf5f");
    playSfx("bomb");
  }
}

function endGame(message) {
  running = false;
  state.mode = "done";
  state.message = message;
  const savedScore = saveScore(message === "Winner");
  renderScores();
  syncScore(savedScore);
  playSfx(message === "Winner" ? "win" : "gameOver");
  startPanel.querySelector("h1").textContent = message;
  startPanel.querySelector("p").textContent = isSupabaseConfigured()
    ? "Score saved. Enter a username and start again."
    : "Score saved locally. Add the Supabase anon key to enable global scores.";
  startPanel.classList.remove("is-hidden");
}

function updateMusicButton() {
  if (!musicToggle) return;
  musicToggle.textContent = musicEnabled ? "Music On" : "Music Off";
  musicToggle.setAttribute("aria-pressed", String(musicEnabled));
}

function setupAudio() {
  if (audioContext || !window.AudioContext && !window.webkitAudioContext) return Boolean(audioContext);
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  audioContext = new AudioCtor();
  masterGain = audioContext.createGain();
  musicGain = audioContext.createGain();
  sfxGain = audioContext.createGain();
  masterGain.gain.value = 0.42;
  musicGain.gain.value = 0.2;
  sfxGain.gain.value = 0.34;
  musicGain.connect(masterGain);
  sfxGain.connect(masterGain);
  masterGain.connect(audioContext.destination);
  return true;
}

function setMusicEnabled(enabled) {
  musicEnabled = enabled;
  localStorage.setItem(MUSIC_KEY, enabled ? "1" : "0");
  updateMusicButton();
  if (enabled) startMusic();
  else stopMusic();
}

function startMusic() {
  if (!setupAudio()) return;
  audioContext.resume();
  if (musicTimer) return;
  scheduleMusicStep();
  musicTimer = window.setInterval(scheduleMusicStep, 125);
}

function stopMusic() {
  window.clearInterval(musicTimer);
  musicTimer = 0;
  musicStep = 0;
}

function scheduleMusicStep() {
  if (!audioContext || !musicGain) return;
  const t = audioContext.currentTime + 0.02;
  const step = musicStep % 32;
  const bass = [55, 55, 82.41, 55, 73.42, 55, 98, 82.41];
  const lead = [220, 0, 261.63, 0, 293.66, 329.63, 293.66, 261.63, 220, 0, 196, 0, 220, 246.94, 261.63, 329.63];

  if (step % 2 === 0) {
    playTone(bass[(step / 2) % bass.length], 0.08, t, "square", 0.16, musicGain);
  }
  if (step % 4 !== 1) {
    const note = lead[step % lead.length];
    if (note) playTone(note, 0.055, t, "square", 0.07, musicGain);
  }
  if (step % 4 === 0) playNoise(0.04, t, 0.1, musicGain);
  if (step % 8 === 4) playNoise(0.07, t, 0.055, musicGain);
  if (step % 16 === 15) playTone(880, 0.035, t, "triangle", 0.05, musicGain);
  musicStep += 1;
}

function playSfx(type) {
  if (!musicEnabled || !setupAudio()) return;
  audioContext.resume();
  const t = audioContext.currentTime + 0.01;
  const sounds = {
    punch: () => playTone(185, 0.045, t, "square", 0.22, sfxGain, 95),
    kick: () => playTone(132, 0.07, t, "sawtooth", 0.24, sfxGain, 72),
    miss: () => playTone(110, 0.035, t, "triangle", 0.08, sfxGain, 72),
    block: () => playTone(440, 0.04, t, "square", 0.16, sfxGain, 250),
    guard: () => playTone(392, 0.055, t, "triangle", 0.12, sfxGain, 196),
    hurt: () => playTone(90, 0.1, t, "sawtooth", 0.22, sfxGain, 50),
    ko: () => arpeggio([330, 392, 523.25], t, 0.055, 0.13),
    bossDown: () => arpeggio([523.25, 392, 330, 261.63], t, 0.08, 0.18),
    wave: () => arpeggio([261.63, 329.63, 392, 523.25], t, 0.055, 0.12),
    heart: () => arpeggio([523.25, 659.25], t, 0.05, 0.1),
    immunity: () => arpeggio([659.25, 783.99, 987.77], t, 0.045, 0.1),
    bomb: () => playNoise(0.16, t, 0.28, sfxGain),
    win: () => arpeggio([392, 523.25, 659.25, 783.99, 1046.5], t, 0.08, 0.16),
    gameOver: () => arpeggio([220, 196, 164.81, 130.81], t, 0.11, 0.18)
  };
  if (sounds[type]) sounds[type]();
}

function arpeggio(notes, start, duration, volume) {
  notes.forEach((note, index) => {
    playTone(note, duration, start + index * duration * 0.82, "square", volume, sfxGain);
  });
}

function playTone(frequency, duration, start, type, volume, destination, endFrequency) {
  if (!audioContext || !destination) return;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  if (endFrequency) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function playNoise(duration, start, volume, destination) {
  if (!audioContext || !destination) return;
  const bufferSize = Math.max(1, Math.floor(audioContext.sampleRate * duration));
  const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const source = audioContext.createBufferSource();
  const gain = audioContext.createGain();
  source.buffer = buffer;
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(gain);
  gain.connect(destination);
  source.start(start);
  source.stop(start + duration + 0.02);
}

function getSupabaseConfig() {
  const config = window.ROBIN_FIGHT_SUPABASE || {};
  return {
    url: String(config.url || "").trim(),
    anonKey: String(config.anonKey || "").trim()
  };
}

function isSupabaseConfigured() {
  const config = getSupabaseConfig();
  return Boolean(config.url && config.anonKey && window.supabase?.createClient);
}

function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  if (!isSupabaseConfigured()) return null;
  const config = getSupabaseConfig();
  supabaseClient = window.supabase.createClient(config.url, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return supabaseClient;
}

function setScoreboardStatus(text) {
  if (scoreboardStatus) scoreboardStatus.textContent = text;
}

function setScoreboardTitle(text) {
  if (scoreboardTitle) scoreboardTitle.textContent = text;
}

function formatScoreRow(score) {
  return {
    name: score.name || score.username || "player",
    score: Number(score.score) || 0,
    wave: Number(score.wave) || 1,
    winner: Boolean(score.winner),
    date: score.date || score.created_at || new Date().toISOString(),
    durationSeconds: score.durationSeconds ?? score.duration_seconds ?? null
  };
}

async function loadRemoteScores() {
  const client = getSupabaseClient();
  if (!client) {
    remoteScoresReady = false;
    setScoreboardTitle("Local Winners");
    setScoreboardStatus("Local scores active");
    return [];
  }

  const { data, error } = await client.rpc(LEADERBOARD_RPC);

  if (error) throw error;
  remoteScores = (data || []).map(formatScoreRow);
  remoteScoresReady = true;
  setScoreboardTitle("Global Winners");
  setScoreboardStatus("Supabase global leaderboard active");
  return remoteScores;
}

async function refreshRemoteScores() {
  try {
    await loadRemoteScores();
    renderScores();
  } catch (error) {
    remoteScoresReady = false;
    setScoreboardTitle("Local Winners");
    setScoreboardStatus(`Supabase unavailable: ${error.message}`);
    renderScores();
  }
}

async function syncScore(score) {
  const client = getSupabaseClient();
  if (!client || !score) {
    setScoreboardStatus("Local scores active");
    return;
  }

  setScoreboardStatus("Saving global score...");
  const { error } = await client.functions
    .invoke(SUBMIT_SCORE_FUNCTION, {
      body: {
        username: score.name,
        score: score.score,
        wave: score.wave,
        winner: score.winner,
        duration_seconds: score.durationSeconds,
        user_agent: navigator.userAgent.slice(0, 180)
      }
    });

  if (error) {
    setScoreboardStatus(`Global save failed: ${error.message}`);
    return;
  }

  await refreshRemoteScores();
}

function saveScore(winner) {
  const scores = readScores();
  const score = {
    name: playerName.trim().replace(/\s+/g, " ").slice(0, 18) || "player",
    score: Math.round(state.score),
    wave: state.wave,
    winner,
    durationSeconds: Math.max(0, Math.round((performance.now() - gameStartTime) / 1000)),
    date: new Date().toISOString()
  };
  scores.push(score);
  scores.sort((a, b) => b.score - a.score);
  localStorage.setItem(SCORE_KEY, JSON.stringify(scores.slice(0, 10)));
  return score;
}

function readScores() {
  try {
    return JSON.parse(localStorage.getItem(SCORE_KEY)) || [];
  } catch {
    return [];
  }
}

function renderScores() {
  const scores = remoteScoresReady ? remoteScores : readScores().map(formatScoreRow);
  scoreList.innerHTML = "";
  if (scores.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = "No runs yet";
    scoreList.appendChild(empty);
    return;
  }
  for (const score of scores) {
    const item = document.createElement("li");
    const duration = score.durationSeconds ? ` · ${score.durationSeconds}s` : "";
    item.innerHTML = `<strong>${escapeHtml(score.name)}</strong><br>${score.score} pts ${score.winner ? "Winner" : "Wave " + score.wave}${duration}`;
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
  const attackDuration = enemy.kind === "bear" ? 0.34 : 0.22;
  const attackLunge = enemy.attackAnim > 0
    ? enemy.facing * (enemy.kind === "bear" ? 34 : 22) * Math.sin((enemy.attackAnim / attackDuration) * Math.PI)
    : 0;
  const walkStep = enemy.action === "walk" ? Math.sin(enemy.walkCycle) * (enemy.kind === "bear" ? 9 : 6) : 0;
  const defendScaleX = enemy.action === "defend" ? 0.9 : 1;
  const defendScaleY = enemy.action === "defend" ? 1.04 : 1;
  const hitLean = enemy.action === "hit" ? -enemy.facing * 0.055 : 0;
  const walkLean = enemy.action === "walk" ? Math.sin(enemy.walkCycle) * 0.035 : 0;
  const attackLean = enemy.action === "attack" ? enemy.facing * 0.075 : 0;
  const defendLean = enemy.action === "defend" ? -enemy.facing * 0.045 : 0;
  const rotation = hitLean + walkLean + attackLean + defendLean;

  if (enemy.kind === "boss") {
    const img = assets.boss;
    if (img.complete) {
      const dw = enemy.w * 1.6;
      const dh = enemy.h * 1.6;
      drawFacingImage(img, 0, 0, img.width, img.height, enemy.x - 92 + attackLunge + walkStep, enemy.y - dh + 138, dw, dh, enemy.facing, defendScaleX, defendScaleY, rotation);
    }
  } else if (enemy.kind === "bear") {
    const img = assets.bear;
    if (img.complete) {
      const dw = enemy.w * 1.55;
      const dh = enemy.h * 1.55;
      drawFacingImage(img, 0, 0, img.width, img.height, enemy.x - 74 + attackLunge + walkStep, enemy.y - dh + 126, dw, dh, enemy.facing, defendScaleX, defendScaleY, rotation);
    }
  } else {
    const sheet = assets.villains;
    if (sheet.complete) {
      const sw = sheet.width / 5;
      const sh = sheet.height;
      const dw = enemy.w * 1.74;
      const dh = enemy.h * 1.74;
      drawFacingImage(sheet, enemy.frame * sw, 0, sw, sh, enemy.x - 50 + attackLunge + walkStep, enemy.y - dh + 110, dw, dh, enemy.facing, defendScaleX, defendScaleY, rotation);
    }
  }

  ctx.restore();
  if (enemy.defendTimer > 0) drawGuardArc(enemy.x + enemy.w * 0.43, enemy.y - enemy.h * 0.5, enemy.kind === "bear" ? "#ff6f66" : "#d7f7b4", 0.22);
}

function drawFacingImage(img, sx, sy, sw, sh, dx, dy, dw, dh, facing, scaleX = 1, scaleY = 1, rotation = 0) {
  ctx.save();
  ctx.translate(dx + dw / 2, dy + dh / 2);
  ctx.scale(facing === -1 ? -scaleX : scaleX, scaleY);
  ctx.rotate(rotation);
  ctx.drawImage(img, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();
}

function drawEnemyBars() {
  for (const enemy of state.enemies) {
    const box = enemyBox(enemy);
    const pct = clamp(enemy.hp / enemy.maxHp, 0, 1);
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(box.x, box.y - 16, box.w, 6);
    ctx.fillStyle = enemy.kind === "boss" ? "#f3eed9" : enemy.kind === "bear" ? "#ff4d42" : "#79f1a8";
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
  if (enemy.kind === "bear") {
    return {
      x: enemy.x + enemy.w * 0.15,
      y: enemy.y - enemy.h + 56,
      w: enemy.w * 0.7,
      h: enemy.h * 0.96
    };
  }

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
  if (!remoteScoresReady) setScoreboardStatus("Local scores cleared");
  renderScores();
});

if (musicToggle) {
  musicToggle.addEventListener("click", () => {
    setMusicEnabled(!musicEnabled);
  });
}

Promise.all(Object.values(assets).map((img) => new Promise((resolve) => {
  if (img.complete) resolve();
  else img.addEventListener("load", resolve, { once: true });
}))).then(() => {
  updateHud();
  renderScores();
  refreshRemoteScores();
  updateMusicButton();
  draw();
  if (params.get("agent") === "1" || params.get("bot") === "1") {
    playerNameInput.value = params.get("name") || "Agent";
    setAgentMode(true, { loop: params.get("loop") !== "0" });
  }
});
