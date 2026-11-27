// Character Creator rules: attribute costs, skill slots, "Choose One" skills. Pure.
export const ATTRS = ["Adroitness", "Raw Strength", "Intellect", "Charm"];
export const ATTR_COST = { "-3": 0, "-2": 1, "-1": 3, "0": 7, "1": 14, "2": 25, "3": 41 }; // from the Starting Attribute Calculator
export const ATTR_SETS = [[1, 1, 0, 0], [2, -1, 0, 0], [3, -2, -3, -3], [1, 1, 1, -3], [2, 1, -1, -3]]; // its preset arrays (42 each)
export const LEVEL_SLOTS = [["+1", 1, 1], ["0", 0, 3], ["-2", -2, 2], ["-3", -3, 2]]; // label, level, how many
export const attrCostOf = (attrs) => ATTRS.reduce((s, a) => s + ATTR_COST[String(attrs[a])], 0);
export const chooseOpts = (base) => { const m = String(base).match(/\(Choose One:\s*([^)]*)\)/i); return m ? m[1].split(/\s*,\s*/).filter(Boolean) : null; };
export const needsSpec = (base) => /\(Choose One/i.test(base);
export const baseShort = (base) => String(base).replace(/\s*\((Choose One[^)]*|Type Restricted[^)]*)\)\s*/i, " ").trim();
export const specMissing = (s) => needsSpec(s.base) && !s.spec && s.name === baseShort(s.base);
