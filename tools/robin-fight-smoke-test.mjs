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
  await expectOk(`${base}/assets/game/robinman-player-clean.png`);
  await expectOk(`${base}/assets/game/villains-sheet-clean.png`);
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
  for (const token of ["window.RobinFight", "snapshot: getSnapshot", "applyAction", "setAgentMode"]) {
    if (!gameJs.includes(token)) throw new Error(`Missing game control token: ${token}`);
  }

  for (const file of [
    "assets/game/robinman-player-clean.png",
    "assets/game/villains-sheet-clean.png",
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
