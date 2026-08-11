import { spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const minutes = Number(process.argv[2] || 60);
const runCount = Number(process.argv[3] || 1000);
const maxFrames = Number(process.argv[4] || 9000);
const startedAt = Date.now();
const endsAt = startedAt + minutes * 60 * 1000;
const logDir = path.resolve("tmp");
const logPath = path.join(logDir, "robin-fight-soak.log");

mkdirSync(logDir, { recursive: true });
write({ type: "start", minutes, runCount, maxFrames, startedAt: new Date(startedAt).toISOString() });

let pass = 0;
let failures = 0;

while (Date.now() < endsAt) {
  pass += 1;
  const result = spawnSync(process.execPath, ["tools/robin-fight-marathon.mjs", String(runCount), String(maxFrames)], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 15 * 60 * 1000
  });

  const entry = {
    type: "pass",
    pass,
    exitCode: result.status,
    timestamp: new Date().toISOString()
  };

  if (result.status === 0) {
    entry.output = parseOutput(result.stdout);
  } else {
    failures += 1;
    entry.error = result.stderr || result.stdout || "unknown failure";
  }
  write(entry);
}

write({ type: "done", pass, failures, endedAt: new Date().toISOString() });

function parseOutput(output) {
  try {
    return JSON.parse(output);
  } catch {
    return { raw: output.slice(-2000) };
  }
}

function write(payload) {
  appendFileSync(logPath, `${JSON.stringify(payload)}\n`);
  console.log(JSON.stringify(payload));
}
