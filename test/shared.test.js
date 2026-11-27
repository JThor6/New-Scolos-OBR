import { test } from "node:test";
import assert from "node:assert/strict";
import { woundFor, sdResult, sameName, initCompare, initEntries, initMove, turnNames, isCleared, INIT, fmt } from "../shared.js";

test("woundFor: damage bands", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 15].map(woundFor), [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
});
test("sdResult: Delta + Damage Bonus - Armor Bonus", () => {
  const r = sdResult({ att: "Raxx", def: "Goon", delta: 3, db: 2, ab: 1 });
  assert.equal(r.hit, true); assert.equal(r.dmg, 4); assert.equal(r.w, 2); assert.equal(r.headline, "Medium Wound");
});
test("sdResult: a tie is a hit", () => { const r = sdResult({ def: "X", delta: 0, db: 1 }); assert.equal(r.hit, true); assert.equal(r.tie, true); assert.equal(r.w, 1); });
test("sdResult: miss, armor holds, unknown bonus", () => {
  assert.equal(sdResult({ def: "X", delta: -1, db: 3 }).headline, "Miss");
  assert.equal(sdResult({ def: "X", delta: 1, db: 0, ab: 3 }).headline, "Armor holds");
  const u = sdResult({ def: "X", delta: 2 }); assert.equal(u.hit, true); assert.equal(u.w, 0); assert.equal(u.dmg, null);
});
test("sdResult: Stone Skin block and Optical Double never hit", () => {
  assert.equal(sdResult({ def: "X", delta: 5, db: 2, blk: "Stone Skin" }).hit, false);
  assert.equal(sdResult({ def: "X", delta: 5, db: 2, dbl: 1 }).hit, false);
});
test("sameName: loose match on first name", () => {
  assert.ok(sameName("Raxx", "raxx  veldt")); assert.ok(!sameName("Rax", "Raxx")); assert.ok(!sameName("", "Raxx"));
});
test("fmt", () => { assert.equal(fmt(2), "+2"); assert.equal(fmt(0), "0"); assert.equal(fmt(-1), "-1"); });
test("initiative order: total, then Adroitness, then players first", () => {
  const l = [{ total: 2, adr: 0, pc: false, r: 0 }, { total: 2, adr: 1, pc: false, r: 0 }, { total: 2, adr: 1, pc: true, r: 1 }, { total: 3, adr: -2, pc: false, r: 0 }];
  assert.deepEqual(l.sort(initCompare).map(e => [e.total, e.adr, e.pc]), [[3, -2, false], [2, 1, true], [2, 1, false], [2, 0, false]]);
});
const fight = (cur, round = 1) => ({ [INIT]: { sid: "s", open: true, cur, round },
  [INIT + "/p/a"]: { id: "a", sid: "s", name: "Raxx", total: 3, pc: true, r: 0 },
  [INIT + "/m"]: [{ id: "g", sid: "s", name: "Hive Runner ×2", mem: ["Hive Runner 1", "Hive Runner 2"], total: 1, pc: false, r: 0 }] });
test("initMove: steps through group members, then wraps to a new round", () => {
  assert.equal(initEntries(fight("a")).length, 2);
  const m1 = initMove(fight("a"), 1); assert.equal(m1.cur, "g");
  const md = fight("g"); md[INIT].sub = 0;
  const m2 = initMove(md, 1); assert.equal(m2.cur, "g"); assert.equal(m2.sub, 1);
  md[INIT].sub = 1; const m3 = initMove(md, 1); assert.equal(m3.cur, "a"); assert.equal(m3.round, 2);
});
test("turnNames: nothing when no fight is open; a group shows the member whose turn it is", () => {
  assert.deepEqual(turnNames({}), { cur: "", deck: "" });
  const md = fight("g"); md[INIT].sub = 1; assert.deepEqual(turnNames(md), { cur: "Hive Runner 2", deck: "Raxx" });
});
test("isCleared: per-player cut, old numeric marks ignored", () => {
  const c = { r: { t: 1000e3, p: { p1: 500 } } };
  assert.equal(isCleared({ pid: "p1", ts: 400 }, c), true);
  assert.equal(isCleared({ pid: "p1", ts: 600 }, c), false);
  assert.equal(isCleared({ pid: "p2", ts: 1000e3 - 6 * 60e3 }, c), true);
  assert.equal(isCleared({ pid: "p2", ts: 1000e3 - 4 * 60e3 }, c), false);
  assert.equal(isCleared({ pid: "p1", ts: 1 }, { r: 5000 }), false);
});
