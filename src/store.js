import { world } from "@minecraft/server";
import { fail, isValid, log, checkName } from "./util.js";

// Bedrock limits a dynamic-property string to 32767 characters.
// Store splits bigger values into chunks and checks them with a hash on load.
const PREFIX = "ea:";
const CHUNK_SIZE = 30000;
const MARKER_RE = /^~C(\d+):([0-9a-z]+)$/;

function hash(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

const pk = (key) => PREFIX + key;
const chunkKey = (k, i) => `${k}~${i}`;

function check(owner, key) {
  if (!owner || typeof owner.getDynamicProperty !== "function") {
    fail("owner must be `world` or an entity/player");
  }
  if (owner !== world && !isValid(owner)) fail("owner is no longer valid (player left or entity removed)");
  checkName(key, "key");
}

function chunkCount(raw) {
  if (typeof raw !== "string") return 0;
  const m = MARKER_RE.exec(raw);
  return m ? parseInt(m[1], 10) : 0;
}

function eraseChunks(owner, k, from, to) {
  for (let i = from; i < to; i++) owner.setDynamicProperty(chunkKey(k, i), undefined);
}

function readText(owner, key) {
  const k = pk(key);
  const raw = owner.getDynamicProperty(k);
  if (raw === undefined) return undefined;
  if (typeof raw !== "string") {
    log(`"${key}" is not a string, ignoring it`);
    return undefined;
  }
  const m = MARKER_RE.exec(raw);
  if (!m) return raw;
  const n = parseInt(m[1], 10);
  let text = "";
  for (let i = 0; i < n; i++) {
    const part = owner.getDynamicProperty(chunkKey(k, i));
    if (typeof part !== "string") {
      log(`"${key}" is damaged (chunk ${i} missing)`);
      return undefined;
    }
    text += part;
  }
  if (hash(text) !== m[2]) {
    log(`"${key}" is damaged (checksum mismatch)`);
    return undefined;
  }
  return text;
}

function write(owner, key, value, version) {
  const k = pk(key);
  const text = JSON.stringify({ v: version, d: value });
  if (text === undefined) fail(`value for "${key}" cannot be saved as JSON`);
  const oldChunks = chunkCount(owner.getDynamicProperty(k));

  if (text.length <= CHUNK_SIZE) {
    try {
      owner.setDynamicProperty(k, text);
    } catch (err) {
      fail(`could not save "${key}": ${err?.message ?? err}`);
    }
    eraseChunks(owner, k, 0, oldChunks);
    return;
  }

  const n = Math.ceil(text.length / CHUNK_SIZE);
  try {
    for (let i = 0; i < n; i++) {
      owner.setDynamicProperty(chunkKey(k, i), text.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
    }
    owner.setDynamicProperty(k, `~C${n}:${hash(text)}`);
  } catch (err) {
    // Remove chunks that did not exist before. If an old value used the same
    // chunk slots it fails the checksum on load and the fallback is returned.
    try { eraseChunks(owner, k, oldChunks, n); } catch { /* ignore */ }
    fail(`could not save "${key}" (${text.length} characters): ${err?.message ?? err}`);
  }
  eraseChunks(owner, k, n, oldChunks);
}

function makeFallback(options) {
  const f = options.fallback;
  if (typeof f === "function") return f();
  return f === undefined ? undefined : JSON.parse(JSON.stringify(f));
}

export const Store = {
  /**
   * Save any JSON-friendly value on `world` or on a player/entity.
   * options.version: schema version of the data (default 1).
   */
  set(owner, key, value, options = {}) {
    check(owner, key);
    if (value === undefined) fail(`use Store.delete() to remove "${key}"`);
    write(owner, key, value, options.version ?? 1);
    return value;
  },

  /**
   * Load a value. options.fallback is returned when nothing (or damaged data) is saved.
   * options.version + options.migrate(data, fromVersion) upgrade old saves;
   * migrate must return the data upgraded by ONE version.
   */
  get(owner, key, options = {}) {
    check(owner, key);
    const text = readText(owner, key);
    if (text === undefined) return makeFallback(options);

    let env;
    try {
      env = JSON.parse(text);
    } catch {
      env = undefined;
    }
    if (!env || typeof env !== "object" || !("d" in env)) {
      log(`"${key}" is damaged (invalid data), using fallback`);
      return makeFallback(options);
    }

    let data = env.d;
    const target = options.version;
    if (target !== undefined && typeof env.v === "number") {
      if (env.v > target) {
        log(`"${key}" was saved by a newer version (${env.v} > ${target}); using it as is`);
        return data;
      }
      if (env.v < target) {
        if (typeof options.migrate !== "function") {
          fail(`"${key}" is version ${env.v} but version ${target} is expected, and no migrate() was given`);
        }
        let from = env.v;
        while (from < target) {
          data = options.migrate(data, from);
          from++;
        }
        try {
          write(owner, key, data, target);
        } catch (err) {
          log(`could not save migrated "${key}": ${err?.message ?? err}`);
        }
      }
    }
    return data;
  },

  /** Read, change, save. `fn` may mutate the value and return nothing, or return a new value. */
  update(owner, key, fn, options = {}) {
    let current = Store.get(owner, key, options);
    const next = fn(current);
    if (next !== undefined) current = next;
    Store.set(owner, key, current, { version: options.version ?? 1 });
    return current;
  },

  has(owner, key) {
    check(owner, key);
    return owner.getDynamicProperty(pk(key)) !== undefined;
  },

  delete(owner, key) {
    check(owner, key);
    const k = pk(key);
    const n = chunkCount(owner.getDynamicProperty(k));
    eraseChunks(owner, k, 0, n);
    owner.setDynamicProperty(k, undefined);
  },

  /** Keys saved through Store on this owner. */
  keys(owner) {
    if (!owner || typeof owner.getDynamicPropertyIds !== "function") fail("owner must be `world` or an entity/player");
    return owner
      .getDynamicPropertyIds()
      .filter((id) => id.startsWith(PREFIX) && !id.includes("~"))
      .map((id) => id.slice(PREFIX.length));
  },
};
