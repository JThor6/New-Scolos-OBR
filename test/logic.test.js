import { test } from "node:test";
import assert from "node:assert/strict";
import { num, sgn, nm, tc, pCell } from "../logic/util.js";
import { pickWoundBox, woundSaid, trackOf, healTrack, isMook, monDeadCell } from "../logic/wounds.js";
import { castOdds, schoolsFromNotes, spellMath, spellFx, SPELL_SIZES } from "../logic/spells.js";
import { coDef, copLeftOf, copLadder, KS_ATTACK, W_MEL, W_RNG, kindOfName, monAttacks, defAttr, canDefend } from "../logic/combat.js";
import { levelOf, ptMaxOf, copEmpty, newDayChanges, partySkills } from "../logic/sheet.js";
import { attrCostOf, ATTR_SETS, ATTRS, chooseOpts, needsSpec, baseShort, specMissing } from "../logic/chargen.js";

// ---- util
test("num reads sheet text: signs, commas, unicode minus, blanks", () => {
  assert.equal(num("+2"), 2); assert.equal(num("−3"), -3); assert.equal(num("1,200"), 1200); assert.equal(num(""), null); assert.equal(num("x"), null);
});
test("sgn, nm, tc", () => {
  assert.equal(sgn(3), "+3"); assert.equal(sgn(-1), "-1");
  assert.equal(nm("  Hive   Runner "), "hive runner");
  assert.equal(tc("knowledge of the void"), "Knowledge of the Void");
});
test("pCell reads A1 cells from rows", () => { const v = [["a", "b"], ["c", " d "]]; assert.equal(pCell(v, "B2"), "d"); assert.equal(pCell(v, "C9"), ""); });

// ---- wounds
const T = (...on) => Array.from({ length: 7 }, (_, i) => on.includes(i));
test("pickWoundBox: each wound level starts at its box", () => {
  assert.equal(pickWoundBox(T(), 1), 0); assert.equal(pickWoundBox(T(), 2), 3); assert.equal(pickWoundBox(T(), 3), 4);
  assert.equal(pickWoundBox(T(), 4), 5); assert.equal(pickWoundBox(T(), 5), 6);
});
test("pickWoundBox: full boxes move right, all full = already dead", () => {
  assert.equal(pickWoundBox(T(0, 1, 2), 1), 3); assert.equal(pickWoundBox(T(3, 4), 2), 5);
  assert.equal(pickWoundBox(T(0, 1, 2, 3, 4, 5, 6), 1), -1); assert.equal(pickWoundBox(T(6), 5), -1);
});
test("woundSaid", () => {
  assert.equal(woundSaid("Raxx", 6, 5), "Dead marked on Raxx");
  assert.equal(woundSaid("Raxx", 3, 1), "Medium Wound marked on Raxx (boxes full, moved right)");
  assert.equal(woundSaid("Raxx", -1, 2), "Raxx is already dead");
});
test("trackOf reads row 16 B-H", () => { const v = []; v[15] = ["Vitality", "X", "", "", "X", "", "", "TRUE"]; assert.deepEqual(trackOf(v), T(0, 3, 6)); });
test("healTrack: one step shifts left, full clears wounds, Dead stays", () => {
  assert.deepEqual(healTrack(T(0, 1, 3), false), T(0, 2));
  assert.deepEqual(healTrack(T(0, 1, 2, 3, 4, 5, 6), true), T(6));
});
test("isMook / monDeadCell", () => {
  assert.ok(isMook(["Goon Mook"])); assert.ok(isMook(["Goon", "", "Minions"])); assert.ok(!isMook(["Hive Runner", "", "Brute"]));
  const r = []; r[19] = "TRUE"; assert.ok(monDeadCell(r)); r[19] = "FALSE"; assert.ok(!monDeadCell(r));
});

// ---- spells
test("castOdds: 4 Fudge dice", () => {
  assert.equal(castOdds(0, 0), 62); assert.equal(castOdds(0, 2), 19); assert.equal(castOdds(4, 0), 100); assert.equal(castOdds(0, 5), 0);
});
test("spell sizes: SP, difficulty, Damage Bonus", () => { assert.deepEqual(SPELL_SIZES.find(z => z[0] === "Medium"), ["Medium", 4, 4, 3]); });
test("schoolsFromNotes", () => {
  assert.deepEqual(schoolsFromNotes(["", "Major school: Fexgem", "minor school: Solar Wind"]), { major: "Fexgem", minor: "Solar Wind" });
  assert.deepEqual(schoolsFromNotes([]), { major: "", minor: "" });
});
test("spellMath: attacks, areas, resisted spells", () => {
  const a = spellMath("Spell attack on one target up to 60 ft. Spellcasting vs Adroitness, Damage Bonus +2.");
  assert.deepEqual([a.atk, a.db, a.dfa, a.area], [true, 2, "Adroitness", false]);
  const b = spellMath("Everyone in a huge area: Spellcasting vs Adroitness, Damage Bonus +5.");
  assert.equal(b.area, true); assert.equal(b.atk, true);
  const c = spellMath("Spellcasting vs the highest Intellect. They forget the last minute.");
  assert.deepEqual([c.atk, c.vs, c.dfa], [false, true, "Intellect"]);
  const d = spellMath("A wall of ice. Anyone crossing it: Spellcasting vs Adroitness, Damage Bonus +2.");
  assert.equal(d.atk, false);
});
test("spellFx: names match loosely", () => { assert.equal(spellFx(" Stone Skin ").nohit, 1); assert.equal(spellFx("Kindle"), null); });

// ---- combat
test("coDef ignores notes in brackets", () => { assert.ok(coDef("Attack Twice (2nd weapon)")); assert.ok(coDef("ENCOURAGE")); assert.equal(coDef("Fly"), null); });
test("copLeftOf", () => { assert.equal(copLeftOf("3", "1"), 2); assert.equal(copLeftOf("2", "5"), 0); assert.equal(copLeftOf("", "1"), null); assert.equal(copLeftOf("2", ""), 2); });
test("copLadder: options known by level", () => { assert.deepEqual([0, 1, 3, 4, 9, 10, 19, 20].map(copLadder), [0, 1, 1, 2, 2, 3, 3, 4]); });
test("attack skills: Kill Shot and Combat Options", () => {
  for (const s of ["Ranged Weapons", "Melee Weapon Fighting", "Martial Arts", "Laser Pistol", "Knife"]) assert.ok(KS_ATTACK.test(s), s);
  for (const s of ["Sneak", "Spellcasting", "Prayer", "Piloting"]) assert.ok(!KS_ATTACK.test(s), s);
  assert.ok(W_MEL.test("Knife")); assert.ok(W_RNG.test("Laser Pistol")); assert.ok(!W_MEL.test("Rifle"));
});
test("kindOfName: type tab first, then the built-in combat list", () => {
  assert.equal(kindOfName("Kill Shot"), "combat"); assert.equal(kindOfName("Lockpick Sense"), "utility");
  assert.equal(kindOfName("Kill Shot", { "kill shot": "utility" }), "utility");
});
test("monAttacks splits several attacks and their offense", () => {
  assert.deepEqual(monAttacks("Claw +2; Bite +1", "2; 3"), [{ name: "Claw", val: "+2", off: "2" }, { name: "Bite", val: "+1", off: "3" }]);
  assert.deepEqual(monAttacks("+1", "2"), [{ name: "", val: "+1", off: "2" }]);
  assert.deepEqual(monAttacks("", "1"), [{ name: "", val: "", off: "1" }]);
});
test("defAttr / canDefend", () => {
  assert.equal(defAttr(null), "Adroitness"); assert.equal(defAttr({ dfa: "Intellect" }), "Intellect");
  const w = { att: "Goon", tg: ["Raxx", "Mort"], defs: ["Mort"] };
  assert.equal(canDefend(w, "Raxx"), true); assert.equal(canDefend(w, "Mort"), false); assert.equal(canDefend(w, "Goon"), false); assert.equal(canDefend(w, "Jeremy"), false);
  assert.equal(canDefend({ att: "Goon" }, "Jeremy"), true);
});

// ---- sheet
const sheet = () => { const v = Array.from({ length: 40 }, () => []);
  v[3][2] = "Mage"; v[5][5] = "TRUE"; v[7][5] = "FALSE"; v[12][5] = "2"; v[12][7] = "6"; v[27][7] = "3"; v[28][7] = "1";
  v[19][1] = "Trained Skills"; v[20] = ["", "Spellcasting", "", "", "", "+1"]; v[21] = ["", "laser pistol", "", "", "", "+2"];
  v[22][1] = "Untrained Skills"; v[23] = ["", "Sneak", "", "", "", "-1"]; v[25][1] = "Inventory"; return v; };
test("levelOf / ptMaxOf", () => { assert.equal(levelOf(39), 3); const v = sheet(); assert.equal(ptMaxOf(v), 6); v[12][7] = ""; v[12][6] = "4"; assert.equal(ptMaxOf(v), 4); });
test("newDayChanges: power back, points full, COP full", () => {
  assert.deepEqual(newDayChanges(sheet()), [{ power: false }, { points: 6 }, { copSpent: 3 }]);
});
test("copEmpty: nothing to do when already full or no max", () => { const v = sheet(); v[28][7] = "3"; assert.equal(copEmpty(v), null); v[27][7] = ""; assert.equal(copEmpty(v), null); });
test("partySkills: attacks first, title case", () => {
  assert.deepEqual(partySkills(sheet()).map(s => [s.n, s.t, s.atk]), [["Laser Pistol", 2, true], ["Spellcasting", 1, false], ["Sneak", -1, false]]);
});

// ---- character creator
test("attribute presets all cost 42", () => {
  for (const set of ATTR_SETS) assert.equal(attrCostOf(Object.fromEntries(ATTRS.map((a, i) => [a, set[i]]))), 42, String(set));
});
test("Choose One skills", () => {
  const base = "Knowledge (Choose One: Religion, Xenology)";
  assert.deepEqual(chooseOpts(base), ["Religion", "Xenology"]); assert.ok(needsSpec(base)); assert.equal(baseShort(base), "Knowledge");
  assert.ok(specMissing({ base, name: "Knowledge" })); assert.ok(!specMissing({ base, name: "Knowledge Religion", spec: "Religion" }));
  assert.equal(chooseOpts("Sneak"), null);
});

// ---- Auto damage and test-mode auto defense (Jake, Nov 27)
import { monRowOf } from "../logic/combat.js";
import { pcDown, monDown } from "../logic/wounds.js";
const TRACK = [["Name", "", "Kind"], ["Hive Runner", "", ""], ["Officer Vane", "", ""], ["Hive Runner 2", "", ""]];
test("monRowOf: exact name first, then a single loose match (Hive Runner 1 -> row Hive Runner)", () => {
  assert.equal(monRowOf(TRACK, "Hive Runner 2"), 3);
  assert.equal(monRowOf(TRACK, "Hive Runner 1"), 1);
  assert.equal(monRowOf(TRACK, "officer  vane"), 2);
  assert.equal(monRowOf(TRACK, "Nobody"), -1);
  assert.equal(monRowOf([["Name"], ["Hive Runner A"], ["Hive Runner B"]], "Hive Runner"), -1); // two loose matches: don't guess
});
const pcVals = (marks) => { const v = Array.from({ length: 16 }, () => []); v[15] = ["", ...marks]; return v; };
test("pcDown: KO'd or Dead on the Vitality Track", () => {
  assert.equal(pcDown(pcVals(["x", "", "", "", "", "", ""])), false);
  assert.equal(pcDown(pcVals(["x", "x", "x", "x", "x", "x", ""])), true);
  assert.equal(pcDown(pcVals(["", "", "", "", "", "", "x"])), true);
});
const monR = (name, boxes, dead = "") => { const r = [name, "", ""]; r.length = 20; boxes.forEach((b, i) => r[12 + i] = b); r[19] = dead; return r; };
test("monDown: KO or Dead box, or the Dead column; a mook's pre-marked KO box doesn't count", () => {
  assert.equal(monDown(monR("Hive Runner", ["TRUE", "", "", "", "", "", ""])), false);
  assert.equal(monDown(monR("Hive Runner", ["", "", "", "", "", "TRUE", ""])), true);
  assert.equal(monDown(monR("Hive Runner", ["", "", "", "", "", "", ""], "TRUE")), true);
  assert.equal(monDown(monR("Grunt Mook", ["", "", "", "TRUE", "TRUE", "TRUE", ""])), false);
  assert.equal(monDown(monR("Grunt Mook", ["", "", "", "TRUE", "TRUE", "TRUE", "TRUE"])), true);
  assert.equal(monDown(monR("Hive Runner", ["", "", "", "", "", "FALSE", ""])), false);
});

// ---- Which party character a target / token name means (Nov 27: "couldn't find Tony")
import { partyMatch } from "../logic/combat.js";
const PC = (n) => ({ id: n, values: [[], [], ["", "", n]] });
test("partyMatch: exact, loose (Raxx -> Raxx Veldt), or the part in brackets (Tony -> Test(Tony)); never a guess", () => {
  const chars = [PC("Test(Tony)"), PC("Raxx Veldt"), PC("David Bowie"), PC("Mort")];
  assert.equal(partyMatch(chars, "Test(Tony)")?.id, "Test(Tony)");
  assert.equal(partyMatch(chars, "tony")?.id, "Test(Tony)");
  assert.equal(partyMatch(chars, "Test")?.id, "Test(Tony)");
  assert.equal(partyMatch(chars, "Raxx")?.id, "Raxx Veldt");
  assert.equal(partyMatch(chars, "Hive Runner 1"), null);
  assert.equal(partyMatch([PC("Test(Tony)"), PC("Test(Justin)")], "Test"), null); // two fit: don't guess
  assert.equal(partyMatch(null, "Tony"), null);
});

// ---- Reset for Battle (Jake, Nov 27): every box off, Dead too
import { battleReset } from "../logic/wounds.js";
test("battleReset: clears the whole Vitality Track including Dead; nothing to do on a clean sheet", () => {
  assert.deepEqual(battleReset(pcVals(["x", "", "", "x", "", "", "x"])), { track: Array(7).fill(false) });
  assert.equal(battleReset(pcVals(["", "", "", "", "", "", ""])), null);
});
