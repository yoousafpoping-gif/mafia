import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const outputDirectory = new URL("../out", import.meta.url);

async function cleanOutput() {
  const attempts = 8;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await rm(outputDirectory, {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 200,
      });
      return;
    } catch (error) {
      if (attempt === attempts || !["EPERM", "EBUSY", "ENOTEMPTY"].includes(error?.code)) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }
  }
}

await cleanOutput();

const nextBin = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
const projectDirectory = fileURLToPath(new URL("..", import.meta.url));
const child = spawn(process.execPath, [nextBin, "build"], {
  cwd: projectDirectory,
  stdio: "inherit",
  shell: false,
});

child.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`Next.js build terminated by ${signal}`);
    process.exitCode = 1;
    return;
  }

  process.exitCode = code ?? 1;
});
