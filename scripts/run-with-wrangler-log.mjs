import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const [bin, ...args] = process.argv.slice(2);

if (!bin) {
  console.error("usage: node scripts/run-with-wrangler-log.mjs <command> [args...]");
  process.exit(1);
}

const wranglerLogPath = resolve(".wrangler/wrangler.log");
mkdirSync(dirname(wranglerLogPath), { recursive: true });

const child = spawn(bin, args, {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    WRANGLER_LOG_PATH: wranglerLogPath,
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
