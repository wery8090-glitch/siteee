import { spawnSync } from "node:child_process";

const npmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const result = spawnSync(npmCommand, ["exec", "vite", "build"], {
  stdio: "inherit",
  env: { ...process.env, VERCEL: "1" },
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

const server = spawnSync(npmCommand, ["exec", "esbuild", "server/_core/index.ts", "--platform=node", "--packages=external", "--bundle", "--format=esm", "--outdir=dist"], { stdio: "inherit", env: process.env });
if (server.error) throw server.error;
process.exit(server.status ?? 0);
