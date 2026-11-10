// Copies the EditionAPI source into a pack's scripts folder, so the API travels inside your mod.
//   node tools/build.mjs                      -> example-mod/BP/scripts/editionapi
//   node tools/build.mjs path/to/BP/scripts   -> path/to/BP/scripts/editionapi
import { cpSync, rmSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const scriptsDir = resolve(process.argv[2] ?? join(root, "example-mod/BP/scripts"));
if (!existsSync(scriptsDir)) mkdirSync(scriptsDir, { recursive: true });
const target = join(scriptsDir, "editionapi");
rmSync(target, { recursive: true, force: true });
cpSync(join(root, "src"), target, { recursive: true });
console.log(`EditionAPI copied to ${target}`);
console.log('In your script: import { Stats, Store, MobRules } from "./editionapi/index.js";');
