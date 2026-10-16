import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

async function marker(dir, type) {
  const target = resolve(root, dir);
  await mkdir(target, { recursive: true });
  await writeFile(
    resolve(target, "package.json"),
    JSON.stringify({ type }, null, 2) + "\n",
    "utf8",
  );
  console.log("wrote " + dir + "/package.json -> type: " + type);
}

await marker("lib/esm", "module");
await marker("lib/cjs", "commonjs");
