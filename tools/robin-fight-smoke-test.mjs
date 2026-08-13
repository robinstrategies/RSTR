import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const port = 5185;
const base = `http://127.0.0.1:${port}`;
const serverPath = path.join(root, "tools", "robin-fight-agent-server.mjs");

const server = spawn(process.execPath, [serverPath, String(port)], {
  cwd: root,
  env: { ...process.env, ROBIN_FIGHT_AGENT_PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"]
});

try {
  await waitFor(`${base}/api/agent/health`);
  await expectOk(`${base}/pages/robin-fight.html`);
  await expectOk(`${base}/assets/game/robin-fight.js`);
  await expectOk(`${base}/assets/game/robin-fight-config.js`);
  await expectOk(`${base}/assets/game/robinman-player-black-gold-neon-arrows.png`);
  await expectOk(`${base}/assets/game/villains-bear-market.png`);
  await expectOk(`${base}/assets/game/bear-market-brute.png`);
  await expectOk(`${base}/assets/game/boss-v2.png`);

  const decision = await postJson(`${base}/api/agent/decision`, {
    snapshot: {
      mode: "playing",
      player: { x: 160, y: 548, hp: 100, maxHp: 100 },
      enemies: [{ x: 420, y: 548, hp: 32, attacking: false, defending: false }],
      items: []
    }
  });
  if (!decision.action || !decision.action.right) {
    throw new Error(`Expected agent to move right toward enemy, got ${JSON.stringify(decision)}`);
  }

  const gameJs = await readFile(path.join(root, "assets", "game", "robin-fight.js"), "utf8");
  for (const token of ["window.RobinFight", "snapshot: getSnapshot", "applyAction", "setAgentMode", "triggerRobinCall", "ROBIN_CALL_DAMAGE"]) {
    if (!gameJs.includes(token)) throw new Error(`Missing game control token: ${token}`);
  }
  for (const token of ["setupGestureControls", "pointerdown", "isCircleGesture", "playerAttack(\"kick\")", "playerAttack(\"punch\")"]) {
    if (!gameJs.includes(token)) throw new Error(`Missing mobile gesture token: ${token}`);
  }

  const gameHtml = await readFile(path.join(root, "pages", "robin-fight.html"), "utf8");
  for (const token of ["Phone: drag left side to move", "tap, swipe up, or hold right side"]) {
    if (!gameHtml.includes(token)) throw new Error(`Missing mobile gesture markup token: ${token}`);
  }
  if (gameHtml.includes("touch-controls") || gameHtml.includes("data-touch-action") || gameHtml.includes("gesture-hint")) {
    throw new Error("Visible mobile control overlays should not be present");
  }

  const gameCss = await readFile(path.join(root, "assets", "game", "robin-fight.css"), "utf8");
  for (const token of ["touch-action: none"]) {
    if (!gameCss.includes(token)) throw new Error(`Missing mobile gesture CSS token: ${token}`);
  }
  if (gameCss.includes(".gesture-hint")) throw new Error("Gesture hint CSS should not be present");

  for (const file of [
    "assets/game/robinman-player-black-gold-neon-arrows.png",
    "assets/game/villains-bear-market.png",
    "assets/game/bear-market-brute.png",
    "tools/robin-fight-agent-server.mjs"
  ]) {
    if (!existsSync(path.join(root, file))) throw new Error(`Missing expected file: ${file}`);
  }

  console.log("Robin Fight smoke test passed");
} finally {
  server.kill();
}

async function waitFor(url) {
  const started = Date.now();
  while (Date.now() - started < 5000) {
    try {
      await expectOk(url);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function expectOk(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response;
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}
