import { world, system } from "@minecraft/server";
import { fail, isValid, log, fullId } from "./util.js";

const FOREVER = 19999999;
const rules = new Map();
let nextId = 1;
let loopId;
const settings = { interval: 40, radius: 64 };

function normalizeEffects(list) {
  if (list === undefined) return [];
  if (!Array.isArray(list)) fail("`effects` must be an array");
  return list.map((e) => {
    if (typeof e === "string") return { id: e, amplifier: 0, duration: FOREVER, showParticles: false };
    if (e && typeof e.id === "string") {
      return {
        id: e.id,
        amplifier: e.amplifier ?? 0,
        duration: e.duration ?? FOREVER,
        showParticles: e.showParticles ?? false,
      };
    }
    return fail('each effect must be a string like "strength" or { id, amplifier, duration }');
  });
}

function applyRule(mob, rule, player) {
  mob.addTag(rule.tag);
  for (const fx of rule.effects) {
    try {
      mob.addEffect(fx.id, fx.duration, { amplifier: fx.amplifier, showParticles: fx.showParticles });
    } catch (err) {
      log(`effect "${fx.id}" failed:`, err?.message ?? err);
    }
  }
  if (rule.health !== undefined) {
    try {
      const hp = mob.getComponent("minecraft:health");
      if (hp) {
        const extra = rule.health - hp.effectiveMax;
        if (extra > 0) {
          mob.addEffect("health_boost", FOREVER, { amplifier: Math.ceil(extra / 4) - 1, showParticles: false });
          hp.resetToMaxValue();
        }
      }
    } catch (err) {
      log("health change failed:", err?.message ?? err);
    }
  }
  if (rule.event) {
    try { mob.triggerEvent(rule.event); } catch (err) { log(`event "${rule.event}" failed:`, err?.message ?? err); }
  }
  if (rule.onApply) {
    try { rule.onApply(mob, player); } catch (err) { log("onApply threw:", err?.message ?? err); }
  }
}

function findMobs(player, rule) {
  const base = { location: player.location, maxDistance: rule.radius ?? settings.radius };
  const dim = player.dimension;
  if (rule.types.length === 0) return dim.getEntities({ ...base, families: rule.families });
  const out = [];
  for (const type of rule.types) out.push(...dim.getEntities({ ...base, type }));
  return out;
}

function tick() {
  if (rules.size === 0) return;
  for (const player of world.getPlayers()) {
    if (!isValid(player)) continue;
    for (const rule of rules.values()) {
      let ok = false;
      try { ok = !!rule.condition(player); } catch (err) { log(`condition of ${rule.id} threw:`, err?.message ?? err); }
      if (!ok) continue;
      let mobs = [];
      try { mobs = findMobs(player, rule); } catch (err) { log("mob search failed:", err?.message ?? err); }
      for (const mob of mobs) {
        if (!isValid(mob) || mob.hasTag(rule.tag)) continue;
        applyRule(mob, rule, player);
      }
    }
  }
}

function startLoop() {
  if (loopId !== undefined) system.clearRun(loopId);
  loopId = system.runInterval(tick, settings.interval);
}

export const MobRules = {
  /**
   * When condition(player) is true, mobs near that player get the changes once.
   * effect: {
   *   mob: "zombie" | ["zombie","skeleton"], family: "monster",
   *   effects: ["strength", { id: "speed", amplifier: 1 }],
   *   health: 40, event: "my:enrage", radius: 64,
   *   onApply: (mob, player) => {}
   * }
   */
  when(condition, effect) {
    if (typeof condition !== "function") fail("first argument must be a function (player) => boolean");
    if (!effect || typeof effect !== "object") fail("second argument must be an object describing the change");
    const types = effect.mob === undefined ? [] : (Array.isArray(effect.mob) ? effect.mob : [effect.mob]).map(fullId);
    const families = effect.family === undefined ? [] : [].concat(effect.family);
    if (types.length === 0 && families.length === 0) fail('give `mob: "zombie"` or `family: "monster"`');
    if (effect.health !== undefined && !(typeof effect.health === "number" && effect.health > 0)) fail("`health` must be a positive number");

    const id = `rule_${nextId++}`;
    rules.set(id, {
      id, tag: `ea_${id}`, condition, types, families,
      effects: normalizeEffects(effect.effects),
      health: effect.health, event: effect.event,
      radius: effect.radius, onApply: effect.onApply,
    });
    if (loopId === undefined) startLoop();
    return id;
  },

  remove(id) {
    return rules.delete(id);
  },

  clear() {
    rules.clear();
  },

  /** Change check frequency (ticks, default 40) and default search radius (default 64). */
  configure(options = {}) {
    if (options.interval !== undefined) {
      if (!Number.isInteger(options.interval) || options.interval < 1) fail("interval must be a whole number of ticks");
      settings.interval = options.interval;
      if (loopId !== undefined) startLoop();
    }
    if (options.radius !== undefined) {
      if (!(options.radius > 0)) fail("radius must be positive");
      settings.radius = options.radius;
    }
  },
};
