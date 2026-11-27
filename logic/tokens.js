// Map tokens: which ones belong to a monster, and keeping "hidden" monsters hidden (Jake, Nov 26). Pure.
import { nm } from "./util.js";

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
