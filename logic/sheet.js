// Reading a character sheet's values (rows of columns, as the Sheet Bridge sends them). Pure.
import { num, tc, pCell } from "./util.js";
import { KS_ATTACK } from "./combat.js";

export const levelOf = (spent) => Math.floor(spent / 10);
// Spell / Prayer Points max: H13, or G13 on older sheets
export function ptMaxOf(v) { const h = String(v[12]?.[7] ?? "").trim(), g = String(v[12]?.[6] ?? "").trim(); return /^\d+$/.test(h) ? +h : /^\d+$/.test(g) ? +g : null; }
// COP back to full: { copSpent } to save, or null if it already is (H28 max, H29 spent... stored as spent count)
export const copEmpty = (v) => { const max = parseInt(String(v[27]?.[7] ?? "")); const now = parseInt(String(v[28]?.[7] ?? "")) || 0; return isNaN(max) || now === max ? null : { copSpent: max }; };
// New Day for one sheet: the saves it needs (powers unused, Spell / Prayer Points full, COP full), or null
export function newDayChanges(v) {
  const out = [];
  if (/^true$/i.test(String(v[5]?.[5] ?? "").trim())) out.push({ power: false });
  if (/^true$/i.test(String(v[7]?.[5] ?? "").trim())) out.push({ utility: false });
  const max = ptMaxOf(v), now = parseInt(String(v[12]?.[5] ?? "")) || 0;
  if (/^(priest|mage)$/i.test(String(v[3]?.[2] ?? "").trim()) && max != null && now !== max) out.push({ points: max });
  const cm = copEmpty(v); if (cm) out.push(cm);
  return out.length ? out : null;
}
// Every skill with a total on the sheet (trained, then untrained), attacks first: [{ n, t, br, atk }]
export function partySkills(v) {
  const col = (r) => String(v[r - 1]?.[1] ?? "").trim();
  let tr = 0, un = 0, inv = 0;
  for (let r = 1; r <= 90; r++) { const b = col(r).toLowerCase(); if (!tr && b === "trained skills") tr = r; else if (!un && b === "untrained skills") un = r; else if (!inv && b === "inventory") inv = r; }
  const out = [], add = (a, b) => { for (let r = a; r < b; r++) { const n = col(r), t = num(pCell(v, "F" + r));
    if (n && t != null) out.push({ n: tc(n), t, br: pCell(v, "C" + r) && pCell(v, "D" + r) !== "" ? `${pCell(v, "C" + r)}|${pCell(v, "D" + r)}|${pCell(v, "E" + r)}` : "", atk: KS_ATTACK.test(n) }); } };
  if (tr) add(tr + 1, un || tr + 18); if (un) add(un + 1, inv || un + 10);
  return out.sort((a, b) => b.atk - a.atk);
}
