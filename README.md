# EditionAPI

A modular JavaScript utility library for Minecraft Bedrock add-on developers.

**EditionAPI v0.1.0** — created by **ModWorld Studio**.

## Modules
- **Store** — dynamic-property storage with chunking, validation, and migrations.
- **Stats** — built-in and custom player statistics.
- **MobRules** — configurable rules for applying effects and health changes to nearby mobs.

## Installation
Download the project source archive from the repository and extract it. Copy `src/` into your behavior pack scripts, then bundle it into your pack with:

```sh
node tools/build.mjs path/to/YourBehaviorPack/scripts
```

The build creates `scripts/editionapi/` in the target behavior pack.

## Quick start

```js
import { world } from "@minecraft/server";
import { Store, Stats, MobRules } from "./editionapi/index.js";

Stats.track("mob_killed", "deaths", "blocks_broken");
MobRules.when(
  (player) => player.hasTag("powered"),
  { mob: "zombie", effects: ["strength", "speed"], radius: 32 }
);
```

Use the complete source and example behavior pack included in the v0.1.0 source archive. Check the README inside the archive for the full API reference and compatibility notes.

## License and credit

EditionAPI is released under the MIT License. You may use, modify, and redistribute it, including in commercial projects, provided you retain the copyright and license notice.

**Credit:** Please credit **ModWorld Studio** and link to this repository when using EditionAPI.

---

Made by ModWorld Studio.
