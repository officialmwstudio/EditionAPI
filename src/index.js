import { VERSION, compareVersions, fail } from "./util.js";
import { Store } from "./store.js";
import { Stats } from "./stats.js";
import { MobRules } from "./mobrules.js";

export { Store, Stats, MobRules, VERSION };

/** Call this first in your mod: EditionAPI.require("0.1.0") stops with a clear message if the bundled API is older. */
export const EditionAPI = {
  version: VERSION,
  require(minVersion) {
    if (compareVersions(VERSION, minVersion) < 0) {
      fail(`this mod needs EditionAPI ${minVersion} or newer, but ${VERSION} is bundled`);
    }
  },
  Store,
  Stats,
  MobRules,
};
