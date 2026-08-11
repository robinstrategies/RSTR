import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const port = Number(process.env.ROBIN_FIGHT_AGENT_PORT || process.argv[2] || 5175);
const host = "127.0.0.1";

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".svg", "image/svg+xml"],
  [".json", "application/json; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"]
]);

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || `${host}:${port}`}`);

    if (request.method === "GET" && url.pathname === "/api/agent") {
      return sendJson(response, {
        ok: true,
        endpoints: {
          agentPage: "/agent",
          decision: "POST /api/agent/decision",
          health: "GET /api/agent/health"
        },
        actionSchema: {
          left: "boolean",
          right: "boolean",
          up: "boolean",
          down: "boolean",
          punch: "boolean",
          kick: "boolean",
          defend: "boolean",
          start: "boolean",
          name: "string"
        }
      });
    }

    if (request.method === "GET" && url.pathname === "/api/agent/health") {
      return sendJson(response, { ok: true, uptimeSeconds: Math.round(process.uptime()) });
    }

    if (request.method === "POST" && url.pathname === "/api/agent/decision") {
      const body = await readJson(request);
      return sendJson(response, { action: chooseAgentAction(body.snapshot || {}) });
    }

    if (request.method === "GET" && url.pathname === "/agent") {
      response.statusCode = 302;
      response.setHeader("Location", "/pages/robin-fight.html?agent=1&loop=1&name=Agent&agentApi=/api/agent/decision");
      response.end();
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      response.statusCode = 405;
      response.end("Method not allowed");
      return;
    }

    await serveStatic(url, response, request.method === "HEAD");
  } catch (error) {
    response.statusCode = 500;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify({ ok: false, error: error.message }));
  }
});

server.listen(port, host, () => {
  console.log(`Robin Fight agent server: http://${host}:${port}/agent`);
  console.log(`Agent decision endpoint: http://${host}:${port}/api/agent/decision`);
});

async function serveStatic(url, response, headOnly) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";
  const requested = path.resolve(root, `.${pathname}`);

  if (!requested.startsWith(root) || !existsSync(requested)) {
    response.statusCode = 404;
    response.end("Not found");
    return;
  }

  const ext = path.extname(requested).toLowerCase();
  response.statusCode = 200;
  response.setHeader("Content-Type", mimeTypes.get(ext) || "application/octet-stream");
  response.setHeader("Cache-Control", "no-store");
  if (headOnly) {
    response.end();
    return;
  }
  response.end(await readFile(requested));
}

function sendJson(response, payload) {
  response.statusCode = 200;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  let raw = "";
  for await (const chunk of request) raw += chunk;
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

function chooseAgentAction(snapshot) {
  if (snapshot.mode !== "playing") return { start: true, name: "Agent" };

  const player = snapshot.player || { x: 160, y: 548, hp: 100, maxHp: 100 };
  const enemies = Array.isArray(snapshot.enemies) ? snapshot.enemies : [];
  const items = Array.isArray(snapshot.items) ? snapshot.items : [];
  const bomb = items.find((item) => item.x >= 40 && item.x <= 1200 && item.type === "bomb" && Math.abs(item.x - player.x) < 70 && Math.abs(item.y - player.y) < 70);

  if (bomb) {
    return {
      left: bomb.x >= player.x,
      right: bomb.x < player.x,
      up: bomb.y >= player.y,
      down: bomb.y < player.y
    };
  }

  const pickup = items
    .filter((item) => item.x >= 40 && item.x <= 1200)
    .filter((item) => item.type !== "bomb" && (item.type !== "heart" || player.hp < player.maxHp - 8))
    .sort((a, b) => distance(player, a) - distance(player, b))[0];

  if (pickup && pickup.life > 0.45 && distance(player, pickup) < 280) {
    return moveToward(player, pickup, 18);
  }

  const target = enemies
    .slice()
    .sort((a, b) => distance(player, a) - distance(player, b))[0];

  if (!target) return { right: player.x < 440, down: player.y < 540, up: player.y > 570 };

  const close = Math.abs(target.x - player.x) < 285 && Math.abs(target.y - player.y) < 68;
  const face = { left: target.x < player.x - 10, right: target.x > player.x + 10 };
  if (close && (target.attacking || player.hp < 30)) return { defend: true };
  if (!close) return moveToward(player, target, 92);
  return target.defending ? { ...face, punch: true } : { ...face, kick: true };
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
  return Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0));
}
