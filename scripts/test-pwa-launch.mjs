import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const testFile = fileURLToPath(new URL("./test-pwa-launch.test.mjs", import.meta.url));
const result = spawnSync(
  process.execPath,
  ["--import", "tsx", "--test", testFile],
  { stdio: "inherit" },
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
