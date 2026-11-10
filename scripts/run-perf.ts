import { spawn, type ChildProcess } from "node:child_process";
import { copyFileSync, createWriteStream, existsSync, readFileSync } from "node:fs";
import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";

const port = process.env.PERF_PORT ?? "3200";
const baseURL = `http://127.0.0.1:${port}`;
const nextBin = "node_modules/.bin/next";
const tsxBin = "node_modules/.bin/tsx";

function run(command: string, args: string[], env: NodeJS.ProcessEnv) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited ${code ?? signal}`));
    });
  });
}

function portFree(target: number) {
  return new Promise<boolean>((resolve) => {
    const probe = net.createServer();
    probe.once("error", () => resolve(false));
    probe.once("listening", () => probe.close(() => resolve(true)));
    probe.listen(target, "127.0.0.1");
  });
}

function stop(child: ChildProcess) {
  if (child.exitCode !== null || child.pid === undefined) return;
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

async function waitForServer(child: ChildProcess) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Performance server exited ${child.exitCode}`);
    try {
      const response = await fetch(`${baseURL}/login`, { redirect: "manual" });
      if (response.status < 500) return;
    } catch {
      // The server is still starting.
    }
    await delay(400);
  }
  throw new Error(`Timed out waiting for ${baseURL}/login`);
}

async function main() {
  const portNumber = Number(port);
  if (!Number.isInteger(portNumber) || portNumber <= 0) throw new Error("PERF_PORT must be a positive integer");
  if (!(await portFree(portNumber))) throw new Error(`Port ${port} is already in use`);
  if (!existsSync(".env")) copyFileSync(".env.example", ".env");

  await run("npm", ["run", "db:perf"], process.env);
  const serverEnv = { ...process.env, DATABASE_URL: "file:./perf.db" };
  await run(nextBin, ["build"], serverEnv);

  const log = createWriteStream("perf-server.log");
  const server = spawn(nextBin, ["start", "-H", "127.0.0.1", "-p", port], {
    env: serverEnv,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout?.pipe(log);
  server.stderr?.pipe(log);
  let failed = false;
  process.once("SIGINT", () => {
    stop(server);
    process.exit(130);
  });
  process.once("SIGTERM", () => {
    stop(server);
    process.exit(143);
  });

  try {
    await waitForServer(server);
    await run(tsxBin, ["scripts/measure-perf.ts"], { ...process.env, PERF_BASE_URL: baseURL });
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    stop(server);
    await delay(300);
    if (server.exitCode === null && server.pid !== undefined) {
      try {
        process.kill(-server.pid, "SIGKILL");
      } catch {
        server.kill("SIGKILL");
      }
    }
    await new Promise<void>((resolve) => log.end(resolve));
    if (failed && existsSync("perf-server.log")) {
      const tail = readFileSync("perf-server.log", "utf8").split("\n").slice(-40).join("\n");
      if (tail.trim()) console.error(tail);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
