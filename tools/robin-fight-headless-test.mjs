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
const canvasListeners = new Map();

function element(id) {
  if (!elements.has(id)) {
    elements.set(id, {
      id,
      value: "",
      textContent: "",
      innerHTML: "",
      style: { setProperty() {} },
      classList: { add() {}, remove() {}, toggle() {} },
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
    },
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 1280, height: 720 };
    },
    addEventListener(type, callback) {
      if (!canvasListeners.has(type)) canvasListeners.set(type, []);
      canvasListeners.get(type).push(callback);
    },
    setPointerCapture() {}
  },
  PointerEvent: class FakePointerEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.pointerId = options.pointerId || 1;
      this.clientX = options.clientX || 0;
      this.clientY = options.clientY || 0;
    }
    preventDefault() {}
  },
  dispatchCanvasPointer(type, options = {}) {
    const event = new context.PointerEvent(type, options);
    for (const callback of canvasListeners.get(type) || []) callback(event);
    return event;
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
        this.width = 2163;
        this.height = 727;
      } else if (value.includes("bear")) {
        this.width = 1024;
        this.height = 1536;
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
  setTimeout(callback) {
    return globalThis.setTimeout(callback, 0);
  },
  clearTimeout(id) {
    globalThis.clearTimeout(id);
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
const gestureStartX = snapshot.player.x;
context.dispatchCanvasPointer("pointerdown", { pointerId: 42, clientX: 120, clientY: 520 });
context.dispatchCanvasPointer("pointermove", { pointerId: 42, clientX: 270, clientY: 520 });
for (let i = 0; i < 12; i += 1) {
  context.__now += 33;
  snapshot = context.window.RobinFight.stepForTest({}, 0.033);
}
context.dispatchCanvasPointer("pointerup", { pointerId: 42, clientX: 270, clientY: 520 });
if (snapshot.player.x <= gestureStartX + 8) {
  throw new Error(`Expected left-side drag to move player right, started ${gestureStartX}, ended ${snapshot.player.x}`);
}

snapshot = context.window.RobinFight.stepForTest({ start: true, name: "HeadlessAgent" });
let beforeCall = context.window.RobinFight.stepForTest({}, 0.033);
beforeCall = context.window.RobinFight.stepForTest({ robinCall: true }, 0.033);
if (beforeCall.robinCallReady || beforeCall.robinCallCooldown <= 0) {
  throw new Error(`Expected Robin Call to start cooldown, got ${JSON.stringify(beforeCall)}`);
}
for (let i = 0; i < 20; i += 1) {
  context.__now += 33;
  beforeCall = context.window.RobinFight.stepForTest({}, 0.033);
}
if (beforeCall.robinCallCooldown >= 28 || beforeCall.robinCallCooldown <= 26) {
  throw new Error(`Expected Robin Call cooldown to tick down, got ${beforeCall.robinCallCooldown}`);
}

snapshot = context.window.RobinFight.stepForTest({ start: true, name: "HeadlessAgent" });
const circle = Array.from({ length: 18 }, (_, index) => {
  const angle = (Math.PI * 2 * index) / 17;
  return [
    1040 + Math.cos(angle) * 72,
    462 + Math.sin(angle) * 58
  ];
});
context.dispatchCanvasPointer("pointerdown", { pointerId: 43, clientX: circle[0][0], clientY: circle[0][1] });
for (let i = 1; i < circle.length; i += 1) {
  context.__now += 33;
  context.dispatchCanvasPointer("pointermove", { pointerId: 43, clientX: circle[i][0], clientY: circle[i][1] });
}
context.dispatchCanvasPointer("pointerup", { pointerId: 43, clientX: circle.at(-1)[0], clientY: circle.at(-1)[1] });
snapshot = context.window.RobinFight.stepForTest({}, 0.033);
if (snapshot.robinCallReady || snapshot.robinCallCooldown <= 0) {
  throw new Error(`Expected circle gesture to trigger Robin Call, got ${JSON.stringify(snapshot)}`);
}

snapshot = context.window.RobinFight.stepForTest({ start: true, name: "HeadlessAgent" });
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
    rotate: noop,
    drawImage: noop,
    fillRect: noop,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    bezierCurveTo: noop,
    quadraticCurveTo: noop,
    arc: noop,
    ellipse: noop,
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
