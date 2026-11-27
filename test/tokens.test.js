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
