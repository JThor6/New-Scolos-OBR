// The Vitality Track: 7 boxes (3 Light, Medium, Critical, Down & KO'ed, Dead). Pure.
export const BOX_START = [0, 0, 3, 4, 5, 6];             // wound level 1..5 -> its first box
export const BOX_NAME = ["Light Wound", "Light Wound", "Light Wound", "Medium Wound", "Critical Wound", "Down & KO'ed", "Dead"];
export const WOUNDS = ["LW", "LW", "LW", "MW", "CW", "KO", "D"];
export const WOUND_DMG = ["1-2", "1-2", "1-2", "3-4", "5-6", "7-8", "9+"]; // damage that lands in each box
// Which box a wound of level w (1..5) marks: its first open box, moving right when full. -1 = already dead.
export function pickWoundBox(marks, w) {
  const start = BOX_START[w];
  for (let i = start; i < 7; i++) if (!marks[i]) return i;
  return -1;
}
// What auto damage says it did
export function woundSaid(name, i, w) {
  const start = BOX_START[w];
  return i < 0 ? `${name} is already dead` : `${BOX_NAME[i]} marked on ${name}${i > start ? " (boxes full, moved right)" : ""}`;
}
// A character sheet's track (row 16, columns B-H) as 7 true/false
export const trackOf = (v) => "BCDEFGH".split("").map((c, i) => !!String(v[15]?.[i + 1] ?? "").trim());
// Healing: one step (every box shifts left) or full (all wounds off). Dead always stays: uncheck it by hand.
export function healTrack(was, full) {
  const six = was.slice(0, 6);
  return (full ? Array(6).fill(false) : six.slice(1).concat(false)).concat(was[6]);
}
// Monster rows on an encounter's Extension Tracker tab: name in A, type in C, boxes M-S (12-18), Dead in T (19)
export const isMook = (r) => /\b(mook|minion)s?\b/i.test(String(r?.[0] ?? "") + " " + String(r?.[2] ?? ""));
export const monDeadCell = (r) => /^(true|x|yes|dead)$/i.test(String(r?.[19] ?? "").trim());
// Down (KO'd or Dead): no defense roll for them (Jake, Nov 27). A mook's KO box comes pre-marked, so only Dead counts there.
const onCell = (x) => !!String(x ?? "").trim() && !/^false$/i.test(String(x).trim());
export const pcDown = (v) => { const t = trackOf(v); return t[5] || t[6]; };
export const monDown = (r) => monDeadCell(r) || onCell(r?.[18]) || (!isMook(r) && onCell(r?.[17]));
// Reset for Battle (Nov 27): every Vitality Track box off, Dead included. null when the track is already clean.
export const battleReset = (v) => trackOf(v).some(Boolean) ? { track: Array(7).fill(false) } : null;
