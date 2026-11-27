import { test } from "node:test";
import assert from "node:assert/strict";
import { INIT } from "../shared.js";
import { fxAlive, fxPlan, fxAct } from "../logic/effects.js";

const roll = (label, extra = {}) => ({ label, mod: 0, total: 1, ...extra });
const ctx = (extra = {}) => ({ me: "Raxx", whoName: "", wait: null, tails: () => true, ...extra });
const NOW = 1e12;

test("fxAlive: drops old effects and ones from another fight", () => {
  assert.equal(fxAlive({ ts: NOW - 9 * 3600e3 }, {}, NOW), false);
  assert.equal(fxAlive({ ts: NOW, sid: "a" }, { [INIT]: { open: true, sid: "b" } }, NOW), false);
  assert.equal(fxAlive({ ts: NOW }, {}, NOW), true);
});
test("fxAlive: 'until my next turn' ends when the user's turn comes round again", () => {
  const md = { [INIT]: { open: true, sid: "s", cur: "a", round: 2 }, [INIT + "/p/a"]: { id: "a", sid: "s", name: "Raxx", total: 1, pc: true, r: 0 } };
  const e = { ts: NOW, sid: "s", end: "turn", by: "Raxx", r0: 1, c0: "a" };
  assert.equal(fxAlive(e, md, NOW), false);
  assert.equal(fxAlive({ ...e, r0: 2 }, md, NOW), true);
});
test("Encourage: +1 on all rolls, and two Encourages don't stack", () => {
  const e = (id) => ({ id, o: "Encourage", on: "all", v: 1, to: ["Raxx"], sid: "s", end: "turn" });
  const r = roll("Sneak"); const acts = fxPlan([e("1"), e("2")], r, ctx());
  assert.equal(r.total, 2); assert.equal(r.mod, 1); assert.deepEqual(acts, []);
});
test("Encourage out of a fight is used up by the first roll", () => {
  const r = roll("Sneak"); const acts = fxPlan([{ id: "1", o: "Encourage", on: "all", v: 1, to: ["Raxx", "Mort"], end: "turn" }], r, ctx());
  assert.deepEqual(acts, [{ a: "use", id: "1", who: "Raxx" }]);
  assert.deepEqual(fxAct([{ id: "1", to: ["Raxx", "Mort"] }], acts[0]), [{ id: "1", to: ["Mort"] }]);
  assert.deepEqual(fxAct([{ id: "1", to: ["Raxx"] }], acts[0]), []);
});
test("Defend a Friend only counts on a defense, not on initiative", () => {
  const e = { id: "1", o: "Defend a Friend", on: "adroit", v: 1, to: ["Raxx"], sid: "s", end: "turn" };
  const a = roll("Adroitness · Defense"); fxPlan([e], a, ctx()); assert.equal(a.total, 2);
  const b = roll("Adroitness · Initiative"); fxPlan([e], b, ctx()); assert.equal(b.total, 1);
});
test("Mark Enemy: +1 on attacks at the marked target, ends after one use out of a fight", () => {
  const e = { id: "m", o: "Mark Enemy", vs: 1, v: 1, to: ["Goon"] };
  const r = roll("Ranged Weapons", { atk: 1, tg: ["Goon"] }); const acts = fxPlan([e], r, ctx());
  assert.equal(r.total, 2); assert.deepEqual(acts, [{ a: "end", id: "m" }]);
  const r2 = roll("Ranged Weapons", { atk: 1, tg: ["Other"] }); fxPlan([e], r2, ctx()); assert.equal(r2.total, 1);
});
test("Stone Skin blocks a hit only when the attack would land", () => {
  const e = { id: "s", o: "Stone Skin", nohit: 1, once: 1, to: ["Raxx"] };
  const hit = roll("Adroitness · Defense", { total: 1 }); const acts = fxPlan([e], hit, ctx({ wait: { at: 3, l: "Claw" } }));
  assert.equal(hit.blk, "Stone Skin"); assert.deepEqual(acts, [{ a: "use", id: "s", who: "Raxx" }]);
  const dodge = roll("Adroitness · Defense", { total: 4 }); fxPlan([e], dodge, ctx({ wait: { at: 3 } })); assert.equal(dodge.blk, undefined);
});
test("Deflect only stops ranged attacks", () => {
  const e = { id: "d", o: "Deflect", nohit: 1, ranged: 1, once: 1, to: ["Raxx"] };
  const melee = roll("Adroitness · Defense"); fxPlan([e], melee, ctx({ wait: { at: 3, l: "Melee Weapon Fighting" } })); assert.equal(melee.blk, undefined);
  const shot = roll("Adroitness · Defense"); fxPlan([e], shot, ctx({ wait: { at: 3, l: "Ranged Weapons" } })); assert.equal(shot.blk, "Deflect");
});
test("Optical Double: tails hits the double; Mirror Images loses a copy", () => {
  const dbl = { id: "o", o: "Create Optical Illusion Double", coin: 1, by: "Raxx", to: [] };
  const r = roll("Adroitness · Defense"); fxPlan([dbl], r, ctx({ wait: { at: 2 } })); assert.equal(r.dbl, 1);
  const h = roll("Adroitness · Defense"); fxPlan([dbl], h, ctx({ wait: { at: 2 }, tails: () => false })); assert.equal(h.dbl, undefined);
  const mi = { id: "mi", o: "Mirror Images", coin: 1, uses: 3, by: "Raxx", to: ["Raxx"] };
  const acts = fxPlan([mi], roll("Adroitness · Defense"), ctx({ wait: { at: 2 } }));
  assert.deepEqual(acts, [{ a: "copies", id: "mi", left: 2 }]);
  assert.equal(fxAct([mi], acts[0])[0].uses, 2); assert.deepEqual(fxAct([{ ...mi, uses: 1 }], { a: "copies", id: "mi", left: 0 }), []);
});
test("Spells on allies: armor and damage bonus", () => {
  const list = [{ id: "1", o: "Gem Armor", on: "armor", v: 1, to: ["Raxx"] }, { id: "2", o: "Burning Blade", on: "dmg", v: 1, to: ["Raxx"] }];
  const def = roll("Adroitness · Defense", { ab: 1 }); fxPlan(list, def, ctx()); assert.equal(def.ab, 2);
  const atk = roll("Melee Weapon Fighting", { atk: 1, db: 2 }); fxPlan(list, atk, ctx()); assert.equal(atk.db, 3);
});
test("On a monster: Weaken -2 damage ends after one hit, Destroy Armor never goes below 0", () => {
  const list = [{ id: "w", o: "Weaken", dmg: -2, to: ["Goon"] }, { id: "a", o: "Destroy Armor", arm: -1, to: ["Goon"] }];
  const atk = roll("Attack", { atk: 1, db: 3 }); const acts = fxPlan(list, atk, ctx({ whoName: "Goon" }));
  assert.equal(atk.db, 1); assert.deepEqual(acts, [{ a: "end", id: "w" }]);
  const def = roll("Adroitness", { ab: 0 }); fxPlan(list, def, ctx({ whoName: "Goon" })); assert.equal(def.ab, 0);
  const def2 = roll("Adroitness", { ab: 2 }); fxPlan(list, def2, ctx({ whoName: "Goon" })); assert.equal(def2.ab, 1);
});
test("No character open: no bonuses", () => { const r = roll("Sneak"); fxPlan([{ id: "1", o: "Encourage", on: "all", v: 1, to: ["Raxx"] }], r, ctx({ me: "" })); assert.equal(r.total, 1); });
