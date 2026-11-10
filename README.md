# EditionAPI

A modular JavaScript utility library for Minecraft Bedrock add-on developers.

**EditionAPI v0.1.0** — created by **ModWorld Studio**.

## Current Version

**EditionAPI v0.1.0**

EditionAPI is currently in early development.
Features and APIs may change in future releases.

[View Releases](https://github.com/officialmwstudio/EditionAPI/releases)

## Modules

- **Store** — dynamic-property storage with chunking, validation, and version migrations.
- **Stats** — built-in and custom player statistics, including kills, deaths, streaks, and blocks broken.
- **MobRules** — configurable rules that apply effects and health changes to nearby mobs when player conditions are met.

## Requirements

- Minecraft Bedrock Edition with Script API support.
- Node.js for the build tool.

The example behavior pack currently declares `@minecraft/server` version `1.19.0`. Adjust the dependency version to match the Script API version supported by your target Minecraft release.

## Installation

Clone or download this repository, then copy the source into your behavior pack's scripts folder:

```sh
node tools/build.mjs path/to/YourBehaviorPack/scripts
```

The build tool creates `scripts/editionapi/` containing the API modules. If no path is supplied, it builds into the included example behavior pack.

## Quick start

```js
import { world } from "@minecraft/server";
import { Store, Stats, MobRules } from "./editionapi/index.js";

// Save and load world data.
Store.set(world, "example", { visits: 1 });
const saved = Store.get(world, "example", { fallback: { visits: 0 } });

// Track built-in player statistics.
Stats.track("mob_killed", "deaths", "blocks_broken");

// Apply a rule to nearby zombies when a player has the required tag.
MobRules.when(
  (player) => player.hasTag("powered"),
  { mob: "zombie", effects: ["strength", "speed"], radius: 32 }
);
```

## License and credit

EditionAPI is released under the MIT License. You may use, modify, and redistribute it, including in commercial projects, provided you retain the copyright and license notice.

Please credit **ModWorld Studio** and link to this repository when using EditionAPI.

---

Made by ModWorld Studio.
