import { test } from "node:test";
import assert from "node:assert/strict";
import { barTap } from "../logic/confirm.js";

// Jake, Nov 26: END COMBAT in test mode never ended the combat
test("END COMBAT: first tap arms, second tap ends the combat", () => {
  assert.deepEqual(barTap("end", false), { run: false, arm: true });
  assert.deepEqual(barTap("end", true), { run: true, arm: false });
});
test("HEAL EVERYONE and NEW DAY also need two taps", () => {
  for (const k of ["healall", "day"]) { assert.deepEqual(barTap(k, false), { run: false, arm: true }, k); assert.deepEqual(barTap(k, true), { run: true, arm: false }, k); }
});
test("everything else runs on one tap", () => {
  for (const k of ["fight", "init", "all", "def", "prev", "next", "heal1", "cop", "tgt"]) assert.deepEqual(barTap(k, false), { run: true, arm: false }, k);
});
