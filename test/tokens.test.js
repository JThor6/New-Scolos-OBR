import { test } from "node:test";
import assert from "node:assert/strict";
import { isToken, tokensOf, toggleHidden, isHidden, toHide, allHidden, setAllHidden } from "../logic/tokens.js";

const tok = (id, name, o = {}) => ({ id, name, type: "IMAGE", layer: "CHARACTER", visible: true, ...o });
const items = [tok("1", "Odo Grisk"), tok("2", "Hive Runner 1"), tok("3", "hive runner 1 ", { visible: false }),
  tok("4", "Hive Runner 1", { layer: "MAP" }), { id: "5", name: "Hive Runner 1", type: "LABEL", layer: "TEXT" }];

test("tokens: only pictures on the character or mount layer", () => {
  assert.ok(isToken(items[0])); assert.ok(!isToken(items[3])); assert.ok(!isToken(items[4]));
});
test("tokensOf matches the monster's name loosely, not other layers", () => {
  assert.deepEqual(tokensOf(items, "Hive Runner 1").map(i => i.id), ["2", "3"]);
});
test("Hide is off by default and toggles per monster", () => {
  assert.equal(isHidden([], "Odo Grisk"), false);
  const on = toggleHidden([], "Odo Grisk"); assert.equal(isHidden(on, "odo  grisk"), true);
  assert.deepEqual(toggleHidden(on, "ODO GRISK"), []);
});
test("toHide: hidden monsters' tokens that are still showing (new tokens too)", () => {
  assert.deepEqual(toHide(items, ["Hive Runner 1"]), ["2"]);
  assert.deepEqual(toHide(items, []), []);
});
test("HIDE ALL / SHOW ALL for the whole encounter, leaving other encounters' names alone", () => {
  const names = ["Hive Runner 1", "Odo Grisk"];
  const on = setAllHidden(["Old Boss"], names, true);
  assert.equal(allHidden(on, names), true); assert.ok(isHidden(on, "Old Boss"));
  const off = setAllHidden(on, names, false);
  assert.equal(allHidden(off, names), false); assert.deepEqual(off, ["Old Boss"]);
  assert.equal(allHidden([], []), false);
});

// ---- Camera follows the turn (Jake, Nov 27)
import { turnToken } from "../logic/tokens.js";
const tk = (name, extra = {}) => ({ id: name, name, type: "IMAGE", layer: "CHARACTER", visible: true, position: { x: 1, y: 2 }, ...extra });
test("turnToken: the token whose turn it is; exact name first, loose only if one fits; hidden ones only for the GM", () => {
  const items = [tk("Hive Runner 1"), tk("Hive Runner 10"), tk("Raxx Veldt"), tk("Odo Grisk", { visible: false }), tk("Map", { layer: "MAP" })];
  assert.equal(turnToken(items, "Hive Runner 1", false)?.id, "Hive Runner 1");
  assert.equal(turnToken(items, "Raxx", false)?.id, "Raxx Veldt");
  assert.equal(turnToken(items, "Odo Grisk", false), null);          // hidden: players' cameras don't give it away
  assert.equal(turnToken(items, "Odo Grisk", true)?.id, "Odo Grisk");
  assert.equal(turnToken(items, "Map", true), null);                  // not a token
  assert.equal(turnToken([tk("Hive Runner A"), tk("Hive Runner B")], "Hive Runner", true), null); // two fit: don't guess
  assert.equal(turnToken(items, "", true), null);
});
