import vm from "node:vm";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const source = await readFile(path.join(root, "assets", "game", "robin-fight.js"), "utf8");

const runCount = Number(process.argv[2] || 40);
const maxFrames = Number(process.argv[3] || 9000);
const results = [];

for (let i = 0; i < runCount; i += 1) {
  results.push(await runSeed(1000 + i, maxFrames));
}

const wins = results.filter((run) => run.outcome === "Winner").length;
const losses = results.filter((run) => run.outcome === "Game over").length;
const stuck = results.filter((run) => run.outcome === "Stuck").length;
const bestScore = Math.max(...results.map((run) => run.score));
const avgScore = Math.round(results.reduce((sum, run) => sum + run.score, 0) / results.length);
const bestWave = Math.max(...results.map((run) => run.wave));
const avgFrames = Math.round(results.reduce((sum, run) => sum + run.frames, 0) / results.length);
const summary = { ok: stuck === 0, runCount, wins, losses, stuck, bestWave, bestScore, avgScore, avgFrames };

console.log(JSON.stringify({ summary, sample: results.slice(0, 12) }, null, 2));

if (stuck > 0) throw new Error(`${stuck} marathon runs got stuck`);
if (bestWave < 5) throw new Error(`Expected at least one run to reach boss wave, best wave ${bestWave}`);
if (bestScore < 5000) throw new Error(`Expected meaningful score ceiling, best score ${bestScore}`);

async function runSeed(initialSeed, frames) {
  const context = makeContext(initialSeed);
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "robin-fight.js" });
  await Promise.resolve();

  let snapshot = context.window.RobinFight.stepForTest({ start: true, name: `Agent${initialSeed}` });
  let runBestScore = 0;
  let runBestWave = 1;
  let lastProgressFrame = 0;

  for (let frame = 0; frame < frames; frame += 1) {
    context.__now += 33;
    const action = context.window.RobinFight.chooseAgentAction(snapshot);
    snapshot = context.window.RobinFight.stepForTest(action, 0.033);
    assertFiniteSnapshot(snapshot);

    if (snapshot.score > runBestScore || snapshot.wave > runBestWave) {
      runBestScore = Math.max(runBestScore, snapshot.score);
      runBestWave = Math.max(runBestWave, snapshot.wave);
      lastProgressFrame = frame;
    }

    if (snapshot.mode !== "playing") {
      return {
        seed: initialSeed,
        outcome: snapshot.message,
        score: snapshot.score,
        wave: snapshot.wave,
        hp: snapshot.player.hp,
        frames: frame + 1
      };
    }

    if (frame - lastProgressFrame > 2100) {
      return {
        seed: initialSeed,
        outcome: "Stuck",
        score: snapshot.score,
        wave: snapshot.wave,
        hp: snapshot.player.hp,
        frames: frame + 1,
        enemies: snapshot.enemies,
        items: snapshot.items
      };
    }
  }

  return {
    seed: initialSeed,
    outcome: "Timeout",
    score: snapshot.score,
    wave: snapshot.wave,
    hp: snapshot.player.hp,
    frames
  };
}

function makeContext(seedValue) {
  const elements = new Map();
  const seededMath = Object.create(Math);
  let seed = seedValue >>> 0;
  seededMath.random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const context = {
    console,
    Math: seededMath,
    Promise,
    URLSearchParams,
    location: { search: "" },
    __now: 0,
    performance: { now: () => context.__now },
    window: null,
    document: {
      getElementById(id) {
        if (id === "gameCanvas") return context.canvas;
        return element(elements, id);
      },
      createElement(tag) {
        return element(elements, `created:${tag}:${elements.size}`);
      }
    },
    canvas: {
      width: 1280,
      height: 720,
      getContext() {
        return createCanvasContext();
      }
    },
    localStorage: {
      store: new Map(),
      getItem(key) {
        return this.store.get(key) || null;
      },
      setItem(key, value) {
        this.store.set(key, String(value));
      },
      removeItem(key) {
        this.store.delete(key);
      }
    },
    Image: class FakeImage {
      constructor() {
        this.complete = true;
        this.width = 1280;
        this.height = 720;
      }
      set src(value) {
        this._src = value;
        if (value.includes("robinman")) {
          this.width = 2525;
          this.height = 606;
        } else if (value.includes("villains")) {
          this.width = 2230;
          this.height = 752;
        } else if (value.includes("boss")) {
          this.width = 1210;
          this.height = 1300;
        } else {
          this.width = 1672;
          this.height = 941;
        }
      }
      get src() {
        return this._src;
      }
      addEventListener(_event, callback) {
        queueMicrotask(callback);
      }
    },
    fetch: async () => ({ ok: false, json: async () => ({}) }),
    requestAnimationFrame() {},
    setInterval() {
      return 1;
    },
    clearInterval() {},
    addEventListener() {}
  };
  context.window = context;
  return context;
}

function element(elements, id) {
  if (!elements.has(id)) {
    elements.set(id, {
      id,
      value: "",
      textContent: "",
      innerHTML: "",
      style: {},
      classList: { add() {}, remove() {} },
      setAttribute() {},
      addEventListener() {},
      appendChild() {},
      querySelector(selector) {
        return element(elements, `${id}:${selector}`);
      }
    });
  }
  return elements.get(id);
}

function assertFiniteSnapshot(snapshot) {
  for (const point of [snapshot.player, ...snapshot.enemies, ...snapshot.items]) {
    for (const key of ["x", "y"]) {
      if (typeof point[key] === "number" && !Number.isFinite(point[key])) {
        throw new Error(`Non-finite ${key} in snapshot: ${JSON.stringify(point)}`);
      }
    }
  }
}

function createCanvasContext() {
  const noop = () => {};
  return {
    save: noop,
    restore: noop,
    clearRect: noop,
    translate: noop,
    scale: noop,
    drawImage: noop,
    fillRect: noop,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    bezierCurveTo: noop,
    quadraticCurveTo: noop,
    arc: noop,
    fill: noop,
    stroke: noop,
    closePath: noop,
    strokeText: noop,
    fillText: noop,
    createLinearGradient() {
      return { addColorStop() {} };
    },
    set fillStyle(_value) {},
    set strokeStyle(_value) {},
    set lineWidth(_value) {},
    set font(_value) {},
    set filter(_value) {},
    set globalAlpha(_value) {},
    set shadowColor(_value) {},
    set shadowBlur(_value) {},
    set imageSmoothingEnabled(_value) {}
  };
}
