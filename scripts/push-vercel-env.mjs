/**
 * Read selected env vars from .env.local and push them to Vercel.
 * Vercel CLI accepts ONE environment per `env add` call, so we iterate.
 * Idempotent: skips any (var, env) pair that already exists.
 *
 * Special-case AUTH_URL: production+preview get the deployed URL,
 * development gets localhost.
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

const PRODUCTION_AUTH_URL = "https://lifestarr-integration.vercel.app";

function readEnvValue(name) {
  const lines = readFileSync(".env.local", "utf8").split(/\r?\n/);
  const line = lines.find((l) => l.startsWith(`${name}=`));
  if (!line) return undefined;
  let value = line.substring(name.length + 1);
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return value || undefined;
}

function run(args, stdinValue) {
  return new Promise((resolve, reject) => {
    // shell:true so Windows resolves vercel.cmd via PATH.
    const proc = spawn("vercel", args, {
      stdio: stdinValue !== undefined ? ["pipe", "pipe", "pipe"] : ["ignore", "pipe", "pipe"],
      shell: true,
    });
    let stderr = "";
    let stdout = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    if (stdinValue !== undefined) {
      proc.stdin.write(stdinValue);
      proc.stdin.end();
    }
    proc.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`exit ${code}: ${stderr || stdout}`));
    });
  });
}

async function listExisting() {
  const out = await run(["env", "ls"]);
  // Lines look like: " name   Encrypted   Production, Preview   2m ago"
  const map = new Map(); // name -> Set of envs
  for (const line of out.split("\n")) {
    const m = line.match(/^\s*(\S+)\s+(?:Encrypted|Plain)\s+(.+?)\s+\d+/);
    if (!m) continue;
    const name = m[1];
    const envs = m[2]
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (!map.has(name)) map.set(name, new Set());
    for (const e of envs) map.get(name).add(e);
  }
  return map;
}

async function pushOne(name, value, environment) {
  // --value passes the value as a flag (avoids stdin races), --yes applies to
  // all branches in preview (without a specific branch arg).
  // Quote the value for shell safety; escape embedded double quotes.
  const escaped = `"${value.replace(/"/g, '\\"')}"`;
  await run(["env", "add", name, environment, "--value", escaped, "--yes"]);
}

/**
 * Skipping `preview` because Vercel CLI requires an explicit git branch
 * for preview env vars in non-interactive mode, and we're not actively
 * deploying preview branches. Add manually via the dashboard if needed.
 */
const tasks = [
  {
    name: "AUTH_SECRET",
    value: readEnvValue("AUTH_SECRET"),
    envs: ["production", "development"],
  },
  { name: "AUTH_URL", value: PRODUCTION_AUTH_URL, envs: ["production"] },
  { name: "AUTH_URL", value: "http://localhost:3000", envs: ["development"] },
  {
    name: "AUTH_RESEND_KEY",
    value: readEnvValue("AUTH_RESEND_KEY"),
    envs: ["production", "development"],
  },
  {
    name: "RESEND_FROM_EMAIL",
    value: readEnvValue("RESEND_FROM_EMAIL"),
    envs: ["production", "development"],
  },
  {
    name: "ALLOWED_EMAILS",
    value: readEnvValue("ALLOWED_EMAILS"),
    envs: ["production", "development"],
  },
];

const existing = await listExisting();

let ok = 0,
  skipped = 0,
  alreadySet = 0,
  failed = 0;

for (const task of tasks) {
  if (!task.value) {
    console.log(`SKIP ${task.name} (missing in .env.local)`);
    skipped++;
    continue;
  }
  for (const env of task.envs) {
    const haveSet = existing.get(task.name);
    if (haveSet?.has(env)) {
      console.log(`SKIP ${task.name} → ${env} (already set)`);
      alreadySet++;
      continue;
    }
    process.stdout.write(`PUSH ${task.name} → ${env} … `);
    try {
      await pushOne(task.name, task.value, env);
      console.log("ok");
      ok++;
    } catch (err) {
      console.log(`fail: ${err.message.replace(/\s+/g, " ").slice(0, 200)}`);
      failed++;
    }
  }
}

console.log(`\n${ok} pushed, ${alreadySet} already set, ${skipped} skipped (no value), ${failed} failed.`);
process.exit(failed > 0 ? 1 : 0);
