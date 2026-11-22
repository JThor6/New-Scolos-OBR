// Shared roll storage: each player keeps their own last rolls in room metadata.
// Per-player keys mean two people rolling at once never overwrite each other.
export const NS = "com.newscolos.dice";
export const KEEP = 10; // rolls kept per player (room metadata is capped at ~16 kB total)

export function rollKey(playerId) { return `${NS}/rolls/${playerId}`; }

export function allRolls(metadata) {
  const out = [];
  for (const [k, v] of Object.entries(metadata || {})) {
    if (k.startsWith(`${NS}/rolls/`) && Array.isArray(v)) out.push(...v);
  }
  return out.sort((a, b) => b.ts - a.ts);
}

export function fmt(n) { return n > 0 ? `+${n}` : `${n}`; }

export function summary(r) {
  const what = r.label ? ` ${r.label}` : "";
  return `${r.who} rolled${what}: ${fmt(r.total)}`;
}

// ---------------- Initiative ----------------
// Room metadata:
//   INIT            -> { sid, open, cur, round, removed: [ids] }   (GM writes)
//   INIT/p/<player> -> { id, sid, name, total, adr, pc: true, r }   (each player writes their own)
//   INIT/m          -> [ { id, sid, name, total, adr, pc: false, r } ]  (GM: monster groups and manual adds)
export const INIT = "com.newscolos.init";
// Order: highest total first; ties go to higher Adroitness, then players before non-players, then random.
export function initCompare(a, b) {
  return (b.total - a.total) || ((b.adr || 0) - (a.adr || 0)) || ((b.pc ? 1 : 0) - (a.pc ? 1 : 0)) || (a.r - b.r);
}
export function initEntries(md) {
  const st = md?.[INIT]; if (!st?.sid) return [];
  const removed = new Set(st.removed || []), out = [];
  for (const [k, v] of Object.entries(md)) if (k.startsWith(INIT + "/p/") && v && v.sid === st.sid && !removed.has(v.id)) out.push(v);
  for (const e of (md[INIT + "/m"] || [])) if (e && e.sid === st.sid && !removed.has(e.id)) out.push(e);
  return out.sort(initCompare);
}

// Token conditions ("marks"): the list everyone can pick from, kept in room metadata
export const MARKS = "com.newscolos.marks";
export const MARK_ITEM = "com.newscolos.mark"; // metadata key on the label items stuck to tokens
export const DEFAULT_MARKS = ["Dead ☠️", "Unconscious 💤"];
export const markList = (md) => Array.isArray(md?.[MARKS]) ? md[MARKS] : DEFAULT_MARKS;
