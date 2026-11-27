// Map tokens: which ones belong to a monster, and keeping "hidden" monsters hidden (Jake, Nov 26). Pure.
import { nm } from "./util.js";
import { sameName } from "../shared.js";

export const isToken = (i) => i?.type === "IMAGE" && (i.layer === "CHARACTER" || i.layer === "MOUNT");
// this monster's tokens: same name (case and extra spaces don't matter)
export const tokensOf = (items, name) => (items || []).filter(i => isToken(i) && nm(i.name) === nm(name));
// Hide on/off for one name in the GM's list of hidden monsters
export function toggleHidden(list, name) {
  const l = (list || []).filter(Boolean), k = nm(name);
  return l.some(n => nm(n) === k) ? l.filter(n => nm(n) !== k) : [...l, name];
}
export const isHidden = (list, name) => (list || []).some(n => nm(n) === nm(name));
// Tokens that should be hidden but are showing (a token put on the map after Hide was turned on)
export function toHide(items, list) {
  const set = new Set((list || []).map(nm));
  return (items || []).filter(i => isToken(i) && set.has(nm(i.name)) && i.visible !== false).map(i => i.id);
}
// HIDE ALL / SHOW ALL for every monster on the encounter
export const allHidden = (list, names) => (names || []).length > 0 && names.every(n => isHidden(list, n));
export function setAllHidden(list, names, on) {
  const rest = (list || []).filter(n => !(names || []).some(m => nm(m) === nm(n)));
  return on ? [...rest, ...(names || [])] : rest;
}

// Camera follows the turn (Jake, Nov 27): the token whose turn it is. Exact name first, then a loose match ("Raxx" ->
// "Raxx Veldt") only when one token fits. Hidden tokens only for the GM, so a player's camera never gives one away.
export function turnToken(items, name, gm) {
  if (!nm(name)) return null;
  const toks = (items || []).filter(i => isToken(i) && (gm || i.visible !== false));
  const exact = toks.find(i => nm(i.name) === nm(name)); if (exact) return exact;
  const loose = toks.filter(i => sameName(i.name, name)); return loose.length === 1 ? loose[0] : null;
}
