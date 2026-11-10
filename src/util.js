export const VERSION = "0.1.0";
const TAG = "[EditionAPI]";

export function log(...args) {
  console.warn(TAG, ...args);
}

export function fail(message) {
  throw new Error(`${TAG} ${message}`);
}

/** Works whether the game exposes isValid as a property or as a method. */
export function isValid(entity) {
  try {
    if (entity === undefined || entity === null) return false;
    const v = entity.isValid;
    if (typeof v === "function") return !!v.call(entity);
    return v !== false;
  } catch {
    return false;
  }
}

/** "minecraft:zombie" -> "zombie". Custom namespaces are kept ("mymod:boss"). */
export function normalizeId(id) {
  if (typeof id !== "string" || id.length === 0) fail("expected a non-empty string id");
  return id.startsWith("minecraft:") ? id.slice("minecraft:".length) : id;
}

/** "zombie" -> "minecraft:zombie". */
export function fullId(id) {
  if (typeof id !== "string" || id.length === 0) fail("expected a non-empty string id");
  return id.includes(":") ? id : `minecraft:${id}`;
}

const NAME_RE = /^[A-Za-z0-9_.:-]{1,64}$/;
const BANNED = new Set(["__proto__", "constructor", "prototype"]);

export function checkName(name, what) {
  if (typeof name !== "string" || !NAME_RE.test(name) || BANNED.has(name)) {
    fail(`${what} must be 1-64 characters of letters, numbers, "_", ".", ":" or "-" (got ${JSON.stringify(name)})`);
  }
  return name;
}

export function compareVersions(a, b) {
  const pa = String(a).split(".").map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}
