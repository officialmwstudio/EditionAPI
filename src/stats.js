import { world, system } from "@minecraft/server";
import { Store } from "./store.js";
import { fail, isValid, log, normalizeId, checkName } from "./util.js";

const STORE_KEY = "stats";
const SAVE_EVERY_TICKS = 20;
const BUILTIN = new Set(["mob_killed", "deaths", "blocks_broken"]);

const cache = new Map();
const listeners = new Map();
const tracked = new Set();
let hooked = false;
let deathHooked = false;
let breakHooked = false;

const fresh = () => ({ counts: {}, streak: 0, best: 0 });

function ensureHooks() {
  if (hooked) return;
  hooked = true;
  system.runInterval(() => {
    for (const entry of cache.values()) {
      try { flushEntry(entry); } catch (err) { log("save failed:", err?.message ?? err); }
    }
  }, SAVE_EVERY_TICKS);
  world.afterEvents.playerLeave.subscribe((ev) => {
    cache.delete(ev.playerId);
  });
  world.beforeEvents?.playerLeave?.subscribe((ev) => {
    const entry = cache.get(ev.player?.id);
    if (entry && entry.dirty) system.run(() => { try { flushEntry(entry); } catch { /* player is gone */ } });
  });
}

function entryFor(player) {
  if (!isValid(player)) fail("player is not valid");
  let entry = cache.get(player.id);
  if (!entry) {
    entry = { player, data: Store.get(player, STORE_KEY, { fallback: fresh, version: 1 }), dirty: false };
    cache.set(player.id, entry);
  } else {
    entry.player = player;
  }
  ensureHooks();
  return entry;
}

function flushEntry(entry) {
  if (!entry.dirty || !isValid(entry.player)) return;
  Store.set(entry.player, STORE_KEY, entry.data, { version: 1 });
  entry.dirty = false;
}

function emit(info) {
  for (const key of [info.stat, "*"]) {
    const set = listeners.get(key);
    if (!set) continue;
    for (const fn of [...set]) {
      try { fn(info); } catch (err) { log(`listener for "${key}" threw:`, err?.message ?? err); }
    }
  }
}

function bump(player, stat, sub, amount) {
  checkName(stat, "stat");
  const entry = entryFor(player);
  let c = entry.data.counts[stat];
  if (!c) {
    c = { total: 0, by: {} };
    entry.data.counts[stat] = c;
  }
  c.total += amount;
  let value = c.total;
  if (sub !== null && sub !== undefined) {
    const s = checkName(normalizeId(sub), "sub-stat");
    c.by[s] = (c.by[s] || 0) + amount;
    value = c.by[s];
    entry.dirty = true;
    emit({ player, stat, sub: s, amount, value, total: c.total });
    return value;
  }
  entry.dirty = true;
  emit({ player, stat, sub: null, amount, value, total: c.total });
  return value;
}

function onDeath(ev) {
  try {
    const dead = ev.deadEntity;
    let deadType;
    try { deadType = dead.typeId; } catch { return; }

    if (deadType === "minecraft:player") {
      if (isValid(dead)) {
        entryFor(dead).data.streak = 0;
        entryFor(dead).dirty = true;
        if (tracked.has("deaths")) bump(dead, "deaths", null, 1);
      }
      return;
    }

    const killer = ev.damageSource?.damagingEntity;
    if (killer && killer.typeId === "minecraft:player" && tracked.has("mob_killed") && isValid(killer)) {
      const entry = entryFor(killer);
      entry.data.streak += 1;
      if (entry.data.streak > entry.data.best) entry.data.best = entry.data.streak;
      bump(killer, "mob_killed", deadType, 1);
    }
  } catch (err) {
    log("death handler failed:", err?.message ?? err);
  }
}

function onBreak(ev) {
  try {
    if (!tracked.has("blocks_broken")) return;
    const id = ev.brokenBlockPermutation?.type?.id;
    bump(ev.player, "blocks_broken", id ?? null, 1);
  } catch (err) {
    log("block handler failed:", err?.message ?? err);
  }
}

export const Stats = {
  /** Start counting built-in stats: "mob_killed", "deaths", "blocks_broken". */
  track(...names) {
    for (const name of names) {
      if (!BUILTIN.has(name)) fail(`unknown built-in stat "${name}" (available: ${[...BUILTIN].join(", ")})`);
      tracked.add(name);
    }
    if ((tracked.has("mob_killed") || tracked.has("deaths")) && !deathHooked) {
      deathHooked = true;
      world.afterEvents.entityDie.subscribe(onDeath);
    }
    if (tracked.has("blocks_broken") && !breakHooked) {
      breakHooked = true;
      world.afterEvents.playerBreakBlock.subscribe(onBreak);
    }
  },

  /** Count for a stat. Leave `sub` out for the total, or pass e.g. "zombie". */
  get(player, stat, sub) {
    checkName(stat, "stat");
    const c = entryFor(player).data.counts[stat];
    if (!c) return 0;
    if (sub === undefined || sub === null) return c.total;
    return c.by[normalizeId(sub)] || 0;
  },

  /** Add to any stat (built-in or your own). Returns the new value. */
  increment(player, stat, sub = null, amount = 1) {
    if (typeof amount !== "number" || !Number.isFinite(amount)) fail("amount must be a number");
    return bump(player, stat, sub, amount);
  },

  /** Kills in a row without dying (needs "mob_killed" tracking). */
  streak(player) {
    const d = entryFor(player).data;
    return { current: d.streak, best: d.best };
  },

  /** Reset one stat, or everything when `stat` is left out. */
  reset(player, stat) {
    const entry = entryFor(player);
    if (stat === undefined) {
      entry.data = fresh();
    } else {
      checkName(stat, "stat");
      delete entry.data.counts[stat];
    }
    entry.dirty = true;
  },

  /**
   * Listen for changes. stat can be a name or "*".
   * Callback gets { player, stat, sub, amount, value, total }. Returns an unsubscribe function.
   */
  on(stat, callback) {
    if (stat !== "*") checkName(stat, "stat");
    if (typeof callback !== "function") fail("callback must be a function");
    let set = listeners.get(stat);
    if (!set) {
      set = new Set();
      listeners.set(stat, set);
    }
    set.add(callback);
    return () => set.delete(callback);
  },

  /** Save everything now (normally done automatically every second). */
  flush() {
    for (const entry of cache.values()) flushEntry(entry);
  },

  /** @internal used by the test-suite */
  _clearCache() {
    cache.clear();
  },
};
