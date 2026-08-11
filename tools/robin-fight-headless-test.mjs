import vm from "node:vm";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const source = await readFile(path.join(root, "assets", "game", "robin-fight.js"), "utf8");

const rafQueue = [];
const elements = new Map();
const ctx = createCanvasContext();

function element(id) {
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
        return element(`${id}:${selector}`);
      }
    });
  }
  return elements.get(id);
}

const seededMath = Object.create(Math);
let seed = 123456789;
seededMath.random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

const context = {
  console,
  Math: seededMath,
  Promise,
  URLSearchParams,
  performance: { now: () => context.__now },
  __now: 0,
  window: null,
  location: { search: "" },
  document: {
    getElementById(id) {
      if (id === "gameCanvas") return context.canvas;
      return element(id);
    },
    createElement(tag) {
      return element(`created:${tag}:${elements.size}`);
    }
  },
  canvas: {
    width: 1280,
    height: 720,
    getContext() {
      return ctx;
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
  requestAnimationFrame(callback) {
    rafQueue.push(callback);
  },
  setInterval() {
    return 1;
  },
  clearInterval() {},
  addEventListener() {}
};

context.window = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: "robin-fight.js" });
await Promise.resolve();

if (!context.window.RobinFight) throw new Error("RobinFight API was not exposed");

let snapshot = context.window.RobinFight.stepForTest({ start: true, name: "HeadlessAgent" });
let bestScore = 0;
let bestWave = 1;
let runBestScore = 0;
let runBestWave = 1;
let completedRuns = 0;
let lastProgressFrame = 0;

for (let frame = 0; frame < 9000; frame += 1) {
  context.__now += 33;
  const action = context.window.RobinFight.chooseAgentAction(snapshot);
  snapshot = context.window.RobinFight.stepForTest(action, 0.033);

  if (snapshot.mode !== "playing") {
    completedRuns += 1;
    snapshot = context.window.RobinFight.stepForTest({ start: true, name: "HeadlessAgent" }, 0.033);
    runBestScore = 0;
    runBestWave = 1;
    lastProgressFrame = frame;
  }

  if (snapshot.score > runBestScore || snapshot.wave > runBestWave) {
    runBestScore = Math.max(runBestScore, snapshot.score);
    runBestWave = Math.max(runBestWave, snapshot.wave);
    bestScore = Math.max(bestScore, snapshot.score);
    bestWave = Math.max(bestWave, snapshot.wave);
    lastProgressFrame = frame;
  }

  assertFiniteSnapshot(snapshot);

  if (frame - lastProgressFrame > 2100) {
    throw new Error(`Bot got stuck for 2100 frames: ${JSON.stringify({ frame, bestScore, bestWave, snapshot })}`);
  }
}

if (bestScore < 1000) throw new Error(`Expected meaningful combat score, got ${bestScore}`);
if (bestWave < 2) throw new Error(`Expected bot to reach at least wave 2, got wave ${bestWave}`);

console.log(JSON.stringify({
  ok: true,
  frames: 9000,
  bestScore,
  bestWave,
  completedRuns
}, null, 2));

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
