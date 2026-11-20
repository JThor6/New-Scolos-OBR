// Shared roll storage: each player keeps their own last rolls in room metadata.
// Per-player keys mean two people rolling at once never overwrite each other.
export const NS = "com.newscolos.dice";
export const KEEP = 12; // rolls kept per player (room metadata is capped at ~16 kB total)

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
