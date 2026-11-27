import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chooseTarget, toDown, threat, seeded, dF, roll4, heroFromSheet, monstersFromTracker, takeWound, attack, fight, simulate, rate, isOut, penOf } from "../logic/sim.js";

const jeremy = JSON.parse(readFileSync(new URL("./fixture-jeremy.json", import.meta.url)));
// the Scratch encounter's rows (Extension Tracker), as the sheet has them
const TRACKER = [["Extension Tracker"], [],
  ["Name", "Group", "Kind", "Raw Str", "Adroitness", "Intellect", "Charm", "Attack", "Offense", "Defense", "Armor", "Special"],
  ["The Officer", "Officer", "Full", "+2", "+3", "+2", "+1", "+5", "+3 frost blade", "+2", "+4", "Ignores first wound..."],
  ["Drone 1", "Drone", "Mook", "-3", "+3", "0", "-", "3", "-", "-", "-", "Any hit kills. Latch = opposed Adr."],
  ["Wisp 1", "Wisp", "Mook", "-3", "+3", "-2", "-", "+3", "Mouth dive", "-", "-", "Flies 30 ft."],
  ["Dead Guy", "X", "Full", "0", "0", "0", "0", "+1", "+1", "", "0", "", "", "", "", "", "", "", "", "TRUE"]];
const hero = (o = {}) => ({ side: "party", name: "H", adr: 0, ab: 0, atk: { name: "Rifle", mod: 0, db: 0 }, track: Array(7).fill(false), mook: false, ...o });
const foe = (o = {}) => ({ ...hero(o), side: "foes", name: "F", ...o });
const fixed = (vals) => { let i = 0; return () => vals[i++ % vals.length]; }; // 0 -> die -1, 0.5 -> 0, 0.9 -> +1

test("dice: Fudge faces, 4dF range, seeded runs repeat", () => {
  assert.equal(dF(() => 0), -1); assert.equal(dF(() => 0.5), 0); assert.equal(dF(() => 0.99), 1);
  const a = seeded(7), b = seeded(7), xs = Array.from({ length: 200 }, () => roll4(a));
  assert.deepEqual(xs, Array.from({ length: 200 }, () => roll4(b)));
  assert.ok(Math.min(...xs) >= -4 && Math.max(...xs) <= 4);
});
test("heroFromSheet: Jeremy (Priest): rifle +1, ranged Damage Bonus +4, armor +2, Adroitness +1", () => {
  const h = heroFromSheet(jeremy);
  assert.equal(h.name, "Jeremy Moonsglow"); assert.equal(h.adr, 1); assert.equal(h.ab, 2);
  assert.deepEqual(h.atk, { name: "Rifle", mod: 1, db: 4 });
});
test("heroFromSheet: fresh by default, or with the wounds on the sheet now", () => {
  const v = JSON.parse(JSON.stringify(jeremy)); v[15][4] = "X";
  assert.deepEqual(heroFromSheet(v).track, Array(7).fill(false));
  assert.deepEqual(heroFromSheet(v, { current: true }).track, [false, false, false, true, false, false, false]);
});
test("monstersFromTracker: numbers, mooks pre-marked, dead left out, warnings for missing numbers", () => {
  const { monsters, warn } = monstersFromTracker(TRACKER);
  assert.deepEqual(monsters.map(m => m.name), ["The Officer", "Drone 1", "Wisp 1"]);
  const [off, drone, wisp] = monsters;
  assert.deepEqual([off.adr, off.ab, off.atk.mod, off.atk.db, off.mook], [3, 4, 5, 3, false]);
  assert.deepEqual(drone.track, [false, false, false, true, true, true, false]); assert.equal(drone.oneHit, true);
  assert.equal(wisp.atk.db, 0); assert.ok(warn.some(w => /Wisp 1/.test(w)));
});
test("takeWound: boxes fill and move right; any-hit-kills dies outright", () => {
  const h = hero(); takeWound(h, 1); takeWound(h, 1); takeWound(h, 1); takeWound(h, 1);
  assert.deepEqual(h.track, [true, true, true, true, false, false, false]);
  const d = foe({ oneHit: true }); takeWound(d, 1); assert.equal(d.track[6], true);
  assert.equal(takeWound(hero(), 0), null);
});
test("out of the fight: Down & KO'ed or Dead; mooks only on Dead; wound penalty -1 never for mooks", () => {
  assert.equal(isOut(hero({ track: [0, 0, 0, 0, 0, 1, 0].map(Boolean) })), true);
  const mook = foe({ mook: true, track: [0, 0, 0, 1, 1, 1, 0].map(Boolean) });
  assert.equal(isOut(mook), false); assert.equal(penOf(mook), 0);
  assert.equal(penOf(hero({ track: [1, 1, 1, 1, 1, 0, 0].map(Boolean) })), -1);
});
test("attack: Delta + Damage Bonus - Armor Bonus picks the wound", () => {
  // attacker rolls +4, defender -4: Delta = 8 + 2 (mod) - 0 = 10; damage 10 + 1 - 2 = 9 -> Dead
  const a = hero({ atk: { mod: 2, db: 1 } }), d = foe({ ab: 2 });
  const r = attack(a, d, fixed([0.9, 0.9, 0.9, 0.9, 0, 0, 0, 0]));
  assert.deepEqual([r.hit, r.delta, r.dmg, r.w, r.box], [true, 10, 9, 5, 6]);
  const miss = attack(hero(), foe({ adr: 3 }), fixed([0.5]));
  assert.equal(miss.hit, false);
});
test("fight: a lopsided fight goes to the strong side, same seed same result", () => {
  const strong = [hero({ name: "A", adr: 4, ab: 6, atk: { mod: 6, db: 6 } })], weak = [foe({ name: "Rat", atk: { mod: -4, db: 0 } })];
  const r = fight(strong, weak, seeded(3)); assert.equal(r.win, "party"); assert.equal(r.foesDown, 1);
  assert.deepEqual(fight(strong, weak, seeded(9)), fight(strong, weak, seeded(9)));
});
test("simulate: easy and deadly encounters rate as such", () => {
  const party = [hero({ name: "A", adr: 2, ab: 2, atk: { mod: 3, db: 3 } }), hero({ name: "B", adr: 2, ab: 2, atk: { mod: 3, db: 3 } })];
  const easy = simulate(party, [foe({ name: "Rat", adr: -2, atk: { mod: -3, db: 0 }, mook: true, track: [0, 0, 0, 1, 1, 1, 0].map(Boolean) })], { runs: 100 });
  assert.equal(easy.rating, "Easy"); assert.ok(easy.win >= 97);
  const dragon = foe({ name: "Dragon", adr: 5, ab: 6, atk: { mod: 7, db: 6 } });
  const deadly = simulate(party, [dragon, { ...dragon, name: "Dragon 2" }], { runs: 100 });
  assert.equal(deadly.rating, "Deadly"); assert.ok(deadly.loss > 50);
  assert.equal(deadly.heroes.length, 2);
});
test("rate thresholds", () => {
  assert.equal(rate({ win: 100, anyDown: 0, anyDead: 0 }), "Easy");
  assert.equal(rate({ win: 95, anyDown: 0, anyDead: 0 }), "Medium");
  assert.equal(rate({ win: 90, anyDown: 60, anyDead: 0 }), "Hard");
  assert.equal(rate({ win: 90, anyDown: 10, anyDead: 25 }), "Deadly");
});
test("tactics helpers: boxes left before going down, threat", () => {
  assert.equal(toDown(hero()), 6); assert.equal(toDown(foe({ oneHit: true })), 1);
  assert.equal(toDown(foe({ mook: true, track: [0, 0, 0, 1, 1, 1, 0].map(Boolean) })), 4);
  assert.equal(threat(foe({ atk: { mod: 5, db: 3 } })), 8); assert.equal(threat(foe({ atk: null })), -99);
});
test("chooseTarget: boss = most dangerous, focus = closest to down, random uses the dice", () => {
  const boss = foe({ name: "Boss", atk: { mod: 5, db: 3 } }), rat = foe({ name: "Rat", oneHit: true, atk: { mod: 0, db: 0 } });
  assert.equal(chooseTarget([rat, boss], "boss").name, "Boss");
  assert.equal(chooseTarget([boss, rat], "focus").name, "Rat");
  assert.equal(chooseTarget([boss, rat], "random", () => 0.9).name, "Rat");
  assert.equal(chooseTarget([], "focus"), null);
});
