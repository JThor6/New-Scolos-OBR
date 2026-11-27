// Mage spells: sizes, odds, what a spell's text means, and which spells do something by themselves. Pure.
export const SPELL_SIZES = [["Trick", 0, 0, null], ["Small", 2, 2, 2], ["Medium", 4, 4, 3], ["Large", 6, 6, 4], ["Huge", 8, 8, 5]]; // name, SP, difficulty, Damage Bonus (Mage tab)
// 4 Fudge dice: chance the total meets or beats the difficulty
export const FUDGE = [1, 4, 10, 16, 19, 16, 10, 4, 1]; // ways to roll -4..+4, out of 81
export const castOdds = (mod, diff) => Math.round(100 * FUDGE.reduce((a, w, i) => a + (i - 4 + mod >= diff ? w : 0), 0) / 81);
// "Major school: Cryo" / "Minor school: Ion" lines in Notes (the Character Creator writes them)
export function schoolsFromNotes(cells) {
  const out = { major: "", minor: "" };
  for (const c of cells) { const s = String(c || "");
    const a = s.match(/major school:\s*([A-Za-z ]+)/i), b = s.match(/minor school:\s*([A-Za-z ]+)/i);
    if (a && !out.major) out.major = a[1].trim(); if (b && !out.minor) out.minor = b[1].trim(); }
  return out;
}
// What a spell's text says about rolling it: an attack (Damage Bonus, against which attribute) and whether it hits several
export function spellMath(x) {
  const vs = String(x).match(/spellcasting vs\.?\s*(?:its |the highest |their )?(adroitness|raw strength|intellect|charm)/i);
  const db = String(x).match(/damage bonus\s*\+?(\d+)/i);
  const area = /everyone|up to \d+ targets|each\b|a group|squad/i.test(x);
  const dfa = vs ? vs[1].replace(/\b\w/g, c => c.toUpperCase()) : "";
  return { atk: !!(vs && db && !/crossing it|steps on it|leaving it|in its path/i.test(x)), db: db ? +db[1] : null, dfa, area, vs: !!vs };
}
export const SPELL_FX = {
  "ice armor": { who: "ally", end: "combat", on: "armor", v: 1, x: "+1 Armor Bonus for the scene", tag: "+1 armor" },
  "gem armor": { who: "ally", end: "combat", on: "armor", v: 1, x: "+1 Armor Bonus for the scene", tag: "+1 armor" },
  "fire shield": { who: "self+", end: "combat", on: "armor", v: 2, x: "+2 Armor Bonus for the scene (you and allies within 10 ft)", tag: "+2 armor" },
  "crystal fortress": { who: "self+", end: "combat", on: "armor", v: 2, x: "+2 Armor Bonus while inside the bunker", tag: "+2 armor" },
  "stone skin": { who: "self", end: "combat", once: 1, nohit: 1, x: "The next hit against them does no damage", tag: "blocks a hit" },
  "deflect": { who: "self", end: "combat", once: 1, nohit: 1, ranged: 1, x: "The next ranged attack against them misses", tag: "blocks a shot" },
  "heat shimmer": { who: "self", end: "turn", once: 1, on: "adroit", v: 1, x: "The next attack against them is at -1 (their dodge gets +1)", tag: "dodge +1" },
  "mirror images": { who: "self", end: "combat", coin: 1, uses: 3, x: "3 copies: each attack has a 1 in 2 chance of popping a copy instead", tag: "3 copies" },
  "burning blade": { who: "ally", end: "combat", on: "dmg", v: 1, x: "+1 Damage Bonus on their weapon for the scene", tag: "+1 damage" },
  "sharpen": { who: "ally", end: "combat", on: "dmg", v: 1, x: "+1 Damage Bonus on their blade for the scene", tag: "+1 damage" },
  "shroud": { who: "ally", end: "combat", on: "sneak", v: 1, x: "+1 to Sneak for the scene", tag: "+1 sneak" },
  "veil the crew": { who: "party", end: "combat", on: "sneak", v: 1, x: "+1 to Sneak for the scene (the whole crew)", tag: "+1 sneak" },
  "numb": { who: "foe", end: "combat", once: 1, on: "atk", v: -1, x: "-1 to their next attack", tag: "-1 next attack" },
  "drain": { who: "foe", end: "combat", on: "all", v: -1, x: "-1 to all their rolls for the scene", tag: "-1 all rolls" },
  "weaken": { who: "foe", end: "combat", on: "all", v: -1, x: "-1 to all their rolls for the scene", tag: "-1 all rolls" },
  "break armor": { who: "foe", end: "combat", arm: -99, x: "No Armor Bonus for the scene", tag: "armor gone" },
  "smoke screen": { who: "none", end: "combat", x: "Everyone attacks at -2 inside the gas (scene)", tag: "-2 inside" },
  "frozen room": { who: "none", end: "combat", x: "Everyone but the caster rolls at -1 in this room (scene)", tag: "-1 in room" },
  "slow time": { who: "foe", end: "turn", x: "They act last in the round until the caster's next turn", tag: "act last" },
  "storm sense": { who: "party", end: "manual", x: "Can't be caught off guard by an ambush today", tag: "no ambush" },
};
export const spellFx = (n) => SPELL_FX[String(n || "").trim().toLowerCase()] || null;
