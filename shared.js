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

// One roll in the roll history (DICE tab and its pop-out window). histDetail = the DETAILED view.
export function rollLine(r, histDetail) {
  const face = (d) => d > 0 ? "+" : d < 0 ? "−" : "", cls = (d) => `die ${d > 0 ? "p" : d < 0 ? "m" : ""}`;
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const time = new Date(r.ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const n = (v) => { const x = parseInt(String(v ?? "").replace("−", "-"), 10); return isNaN(x) ? null : x; };
  let label = String(r.label || ""), pen = n(r.wnd);
  // Rolls saved before the fix kept the wound inside the label, and long names cut it off ("... (wounded").
  // Take it out of the label; if the number got cut off it was -1 (the only penalty a character can still roll with).
  const wm = label.match(/\s*\((w(?:o(?:u(?:n(?:d(?:e(?:d)?)?)?)?)?)?)\b([^)]*)\)?\s*$/i);
  if (wm && (wm[1].length >= 4 || !wm[2])) { if (pen == null) pen = n((wm[2] || "").match(/-\d+/)?.[0]) ?? -1; label = label.slice(0, wm.index).trim(); }
  const wtag = pen ? `<span class="wtag">wounded ${fmt(pen)}</span>` : "";
  const dice = `<span class="dice hd">${r.dice.map(d => `<div class="${cls(d)}">${face(d)}</div>`).join("")}</span>`;
  const head = `<div class="hn">${esc(r.char || r.who)}${r.char ? ` <span class="pn">${esc(r.who)}</span>` : ""} <span class="t">${time}</span>${wtag}</div>`;
  const xc = r.ks ? " ks" : r.pw || /^⚡/.test(label) ? " pw" : "";
  if (!histDetail) return `<div class="hl${xc}">${head}<div class="hr">${dice}<span class="hlbl">${esc(label || "Roll")}</span><span class="tot">${fmt(r.total)}</span></div></div>`;
  const ds = r.dice.reduce((a, b) => a + b, 0), rows = [["Dice", ds]];
  if (r.at) {
    rows.push([`${esc(r.at)} <small>attribute</small>`, n(r.av) ?? 0]);
    if (r.sr !== undefined) rows.push([`${esc(label)} <small>skill rank</small>`, n(r.sr) ?? 0]);
  } else {
    const other = (r.mod || 0) - (pen || 0); // older rolls and the DICE tab: one total modifier
    if (other) rows.push(["Modifier", other]);
  }
  if (pen) rows.push([`<span class="wr">Wounded</span>`, pen]);
  const table = rows.map(([k, v]) => `<div class="br"><span>${k}</span><b>${fmt(v)}</b></div>`).join("") +
    `<div class="br res"><span>Result</span><b>${fmt(r.total)}</b></div>`;
  if (r.ks) rows[0][0] = "Dice <small>Kill Shot</small>";
  return `<div class="hl det${xc}">${head}<div class="hlbl full">${esc(label || "Roll")}</div><div class="hr">${dice}<span class="hlbl"></span><span class="tot">${fmt(r.total)}</span></div><div class="brk">${table}</div></div>`;
}
// Styles for rollLine (dice colors come from each page's .die rules)
export const ROLL_CSS = `
  /* roll history */
  .hl { padding:6px 2px; border-bottom:1px solid #333a55; }
  .hl .hn { font-size:12px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .hl .t { color:var(--dim); font-size:10px; font-weight:400; margin-left:4px; }
  .hl .pn { color:var(--dim); font-size:11px; font-weight:600; margin-left:3px; }
  .hl .wtag { margin-left:6px; color:#ff8f8f; font-size:11px; font-weight:900; }
  .hl .hr { display:flex; align-items:center; gap:8px; margin-top:4px; }
  .hl.pw { border-left:3px solid #ffc94d; padding-left:5px; background:rgba(255,201,77,.08); } .hl.pw .hlbl, .hl.pw .tot { color:#ffc94d; }
  .hl.ks { border-left:3px solid #e04a3f; padding-left:5px; background:rgba(150,25,25,.2); } .hl.ks .hlbl, .hl.ks .tot { color:#ff6b5e; }
  .hl .hd { margin:0; flex:none; } .hl .die { width:20px; height:20px; font-size:14px; border-width:1.5px; }
  .hl .hlbl { flex:1; min-width:0; font-size:12px; font-weight:700; color:var(--accent); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .hl .hlbl.full { white-space:normal; margin-top:3px; line-height:1.25; }
  .hl .tot { flex:none; margin-left:auto; font-family:'Luckiest Guy', 'Bangers', Impact, sans-serif; font-size:19px; min-width:36px; text-align:right; padding-top:2px; }
  .hl .brk { margin:5px 0 0 2px; padding:4px 8px; border-left:2px solid #444a66; font-size:11px; }
  .hl .br { display:flex; justify-content:space-between; color:var(--dim); font-weight:700; padding:1px 0; }
  .hl .br small { font-weight:400; opacity:.75; margin-left:3px; } .hl .br b { color:var(--text, #fff); }
  .hl .br .wr, .hl .br:has(.wr) b { color:#ff8f8f; }
  .hl .br.res { border-top:1px solid #444a66; margin-top:2px; padding-top:3px; color:#fff; }
  .histdet { width:100%; margin:4px 0 2px; padding:4px; font-size:11px; font-weight:800; border:1px solid #3a3d55; border-radius:6px; background:var(--paper); color:var(--dim); cursor:pointer; }
`;

// Roll log: the room only holds each player's last 10 rolls (Owlbear's room storage is tiny),
// so every browser also keeps its own copy of the last 100 rolls it has seen in this room.
// Every page calls this with the room's rolls; it merges them in (no duplicates) and returns the newest 100.
export const LOG_MAX = 100;
export function rollLog(roomId, roomRolls) {
  // one log per Owlbear room, so the 47th Precinct room and the main game never mix
  if (!roomId) { try { roomId = atob(new URLSearchParams(location.search).get("obrref") || "").split(" ")[1]; } catch {} }
  const key = "ns.rollLog@" + (roomId || "local");
  let log = [];
  try { log = JSON.parse(localStorage.getItem(key) || "[]"); if (!Array.isArray(log)) log = []; } catch { log = []; }
  const ids = new Set(log.map(r => r.id)); let added = false;
  for (const r of roomRolls || []) if (r?.id && !ids.has(r.id)) { log.push(r); ids.add(r.id); added = true; }
  log.sort((a, b) => b.ts - a.ts); log = log.slice(0, LOG_MAX);
  if (added) try { localStorage.setItem(key, JSON.stringify(log)); } catch {}
  return log;
}
