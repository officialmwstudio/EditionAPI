import { world, ItemStack } from "@minecraft/server";
import { EditionAPI, Stats, MobRules } from "./editionapi/index.js";

EditionAPI.require("0.1.0");

// 1) Count kills and deaths. EditionAPI saves them for you.
Stats.track("mob_killed", "deaths");

// 2) Reward: every 25th zombie gives a diamond sword.
Stats.on("mob_killed", (e) => {
  if (e.sub !== "zombie") return;
  if (e.value % 25 !== 0) return;
  e.player.sendMessage(`§aZombie slayer! ${e.value} zombies killed.`);
  e.player.getComponent("inventory").container.addItem(new ItemStack("minecraft:diamond_sword", 1));
});

// 3) After 50 zombie kills, zombies near you become stronger.
MobRules.when(
  (player) => Stats.get(player, "mob_killed", "zombie") >= 50,
  { mob: "zombie", effects: ["strength"], health: 40 }
);

// 4) Tell players their score when they join.
world.afterEvents.playerSpawn.subscribe((ev) => {
  if (!ev.initialSpawn) return;
  const kills = Stats.get(ev.player, "mob_killed", "zombie");
  ev.player.sendMessage(`§7Zombies killed so far: ${kills}`);
});
