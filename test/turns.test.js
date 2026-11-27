import { test } from "node:test";
import assert from "node:assert/strict";
import { INIT } from "../shared.js";
import { turnKey, stepTurn, pickTurn, autoFirstTurn } from "../logic/turns.js";

const fight = (st) => ({ [INIT]: { sid: "s", open: true, round: 1, ...st },
  [INIT + "/p/a"]: { id: "a", sid: "s", name: "Raxx", total: 4, pc: true, r: 0 },
  [INIT + "/p/b"]: { id: "b", sid: "s", name: "Mort", total: 2, pc: true, r: 0 },
  [INIT + "/p/c"]: { id: "c", sid: "s", name: "Jeremy", total: 0, pc: true, r: 0 } });

test("a fight starts on the first person by itself", () => {
  assert.equal(autoFirstTurn(fight({ cur: "" })).cur, "a");
});
// Jake, Nov 26: the turn landed on the first character, then jumped straight to the second
test("START TURNS tapped after the first turn was already picked: the turn stays on the first person", () => {
  const seen = turnKey(fight({ cur: "" })[INIT]);           // the button was drawn before the turn was picked
  const md = fight({ cur: "a", auto: 1 });                  // then the fight put Raxx up by itself
  assert.equal(stepTurn(md, 1, seen), null);
});
test("NEXT TURN tapped twice for the same turn moves it once", () => {
  const md = fight({ cur: "a" }), seen = turnKey(md[INIT]);
  const first = stepTurn(md, 1, seen); assert.equal(first.cur, "b");
  assert.equal(stepTurn(fight({ ...first }), 1, seen), null);   // second tap still showed Raxx's turn
});
test("NEXT TURN from the turn on screen moves to the next person, then wraps to a new round", () => {
  const md = fight({ cur: "c" });
  const nx = stepTurn(md, 1, turnKey(md[INIT])); assert.equal(nx.cur, "a"); assert.equal(nx.round, 2);
});
test("dead monsters are skipped", () => {
  const md = fight({ cur: "a" });
  assert.equal(stepTurn(md, 1, turnKey(md[INIT]), (n) => n === "Mort").cur, "c");
});
test("picking a name on the bar sticks: the automatic first turn doesn't pull it back to the top", () => {
  const picked = pickTurn(fight({ cur: "a", auto: 1 }), "b");
  assert.equal(picked.cur, "b");
  assert.equal(autoFirstTurn(fight({ ...picked })), null);
});
