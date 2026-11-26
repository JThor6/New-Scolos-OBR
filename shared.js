// Shared roll storage: each player keeps their own last rolls in room metadata.
// Per-player keys mean two people rolling at once never overwrite each other.
export const NS = "com.newscolos.dice";
export const KEEP = 10; // rolls kept per player (room metadata is capped at ~16 kB total)

export function rollKey(playerId) { return `${NS}/rolls/${playerId}`; }

// GM SCREEN's CLEAR buttons (Jake, Nov 26) put a time here for the whole room: { r: rolls cleared at, s: Success Deltas cleared at }
export const CLEARED = `${NS}/cleared`;
const clrKey = (roomId) => "ns.rollClr@" + (roomId || "local");
// Each browser's clock can be a little off, so a clear is cut per player, by that player's own newest roll at the time
// (cut.p[pid]). Players with nothing in the room then: anything over 5 minutes older than the clear. (Nov 26 fix: a GM clock
// ahead of a player's made that player's next rolls look "cleared", so their defense rolls went missing.)
export const isCleared = (r, c) => { if (!c || !r) return false; const cut = r.sd ? c.s : c.r; if (!cut) return false;
  const ts = r.ts || 0; if (typeof cut === "number") return false; // old-style marks (one clock for everyone) are ignored
  const own = cut.p?.[r.pid]; return own != null ? ts <= own : ts <= (cut.t || 0) - 5 * 60e3; };
// GM-only CLEAR button (Jake, Nov 26): k "r" = rolls, "s" = Success Delta results, "rs" = both. Tap, then ARE YOU SURE? within 4 s.
// Clears it for everyone in the room: a time mark in room metadata (every browser drops older entries from its own log) and
// the saved rolls in the room are emptied too.
export const clearBtn = (k, label = "CLEAR") => `<button class="gmsclr" data-clr="${k}" data-lab="${label}" title="Clears it for everyone at the table">${label}</button>`;
export const CLEAR_CSS = `.gmsclr { font:800 11px system-ui; letter-spacing:.5px; background:rgba(40,36,64,.8); border:1px solid #4a4170; color:#b9aee0; border-radius:6px; padding:3px 8px; cursor:pointer; }
  .gmsclr.armed { background:rgba(91,63,158,.75); border-color:#9d86ff; color:#f0eaff; } .gmsclr:disabled { opacity:.6; cursor:default; }`;
export function bindClear(root, OBR, after) {
  root.querySelectorAll(".gmsclr").forEach(b => { if (b._bound) return; b._bound = 1; b.onclick = async (ev) => {
    ev.preventDefault(); ev.stopPropagation();
    const k = b.dataset.clr, lab = b.dataset.lab || "CLEAR";
    if (!b.dataset.armed) { b.dataset.armed = "1"; b.textContent = "ARE YOU SURE?"; b.classList.add("armed");
      clearTimeout(b._t); b._t = setTimeout(() => { delete b.dataset.armed; b.textContent = lab; b.classList.remove("armed"); }, 4000); return; }
    clearTimeout(b._t); delete b.dataset.armed; b.classList.remove("armed"); b.disabled = true; b.textContent = "CLEARING…";
    try {
      const md = await OBR.room.getMetadata(), now = Date.now(), c = { ...(md[CLEARED] || {}) };
      const cuts = (sd) => { const p = {}; for (const [key, v] of Object.entries(md)) if (key.startsWith(`${NS}/rolls/`) && Array.isArray(v) && key.endsWith("~sd") === sd)
        for (const r of v) if (r?.pid) p[r.pid] = Math.max(p[r.pid] || 0, r.ts || 0); return { t: now, p }; };
      if (k.includes("r")) c.r = cuts(false); if (k.includes("s")) c.s = cuts(true);
      const upd = { [CLEARED]: c };
      for (const key of Object.keys(md)) if (key.startsWith(`${NS}/rolls/`) && Array.isArray(md[key]) && (key.endsWith("~sd") ? k.includes("s") : k.includes("r"))) upd[key] = null;
      await OBR.room.setMetadata(upd);
      b.textContent = "✓ CLEARED"; after?.(k);
    } catch { b.textContent = "DIDN'T CLEAR"; }
    setTimeout(() => { b.disabled = false; b.textContent = lab; }, 2000);
  }; });
}
export function allRolls(metadata) {
  const out = [], c = metadata?.[CLEARED] || null;
  for (const [k, v] of Object.entries(metadata || {})) {
    if (k.startsWith(`${NS}/rolls/`) && Array.isArray(v)) out.push(...v.filter(r => !isCleared(r, c)));
  }
  out.sort((a, b) => b.ts - a.ts);
  out.clr = c; // rollLog uses it to clear this browser's own log too
  return out;
}

// Table cards for powers that stay on (c: the look, t: card title, s: line under it)
export const POWER_CARDS = {
  "bullet stop": { c: "bs", n: "Bullet Stop", t: "BULLET STOP ACTIVATED", s: "+2 Armor Bonus for the combat. Allies within 10 ft: +2 until their next turn" },
  "avatar": { c: "av", n: "Avatar", t: "AVATAR", s: "Becomes living magic: +1 Armor, +1 Spellcasting" },
  "flash forward": { c: "ff", t: "FLASH FORWARD", s: "Sees it coming: one forced reroll every round (three a scene out of combat)" },
  "disappear completely": { c: "wr", t: "VANISHED", s: "Gone from sight" },
  "mind over matter": { c: "mm", t: "MIND OVER MATTER", s: "The world starts to float" },
  "spirit walk": { c: "rv", t: "SPIRIT WALK", s: "The body falls still. Something cold moves through the walls" },
  "corpse walk": { c: "rv", t: "CORPSE WALK", s: "The dead get back up, and they don't feel pain" },
  "steady hold": { c: "mm", t: "STEADY HOLD", s: "Something huge stops dead in the air" },
  "hijack": { c: "dp", t: "HIJACK", s: "The tech in the room just changed sides" },
  // daily powers with no roll and nothing that stays on: a card so the table knows it was used
  "kill shot": { c: "ksa", t: "KILL SHOT ARMED", s: "Next attack: +, +, +, +" },
  "hive link": { c: "hv", t: "HIVE LINK", s: "The crew is linked mind to mind" },
  "death mark": { c: "dm", t: "DEATH MARK", s: "Someone has been marked" },
  "echo of the dead": { c: "rv", t: "ECHO OF THE DEAD", s: "A ghost answers the call" },
  "appraiser's eye": { c: "dp", t: "APPRAISER'S EYE", s: "Sizing up what it's worth, and who'd pay" },
  "last rites": { c: "dp", t: "LAST RITES", s: "Jacked into a dead machine" },
  "sleeper code": { c: "dp", t: "SLEEPER CODE", s: "Something is left waiting in the system" },
  "mind touch": { c: "ff", t: "MIND TOUCH", s: "Reaching into someone's head" },
  "borrowed face": { c: "wr", t: "BORROWED FACE", s: "Wearing someone else's face" },
  "commune": { c: "av", t: "COMMUNE", s: "Asks their god one question. A cryptic vision answers" },
};
// Any other daily power: gold card with its name
export const powerCard = (n, label) => POWER_CARDS[n] || { c: "dp", t: String(label || n || "POWER").toUpperCase(), s: "Daily Extraordinary Power" };

// ---------------- Success Delta ----------------
// Damage = Success Delta + Damage Bonus - defender's Armor Bonus, landing on the Vitality Track (Main Sheet row 15).
// i: 1 Light .. 5 Dead, 0 = no wound. c: the color for it.
export const WOUND_STEPS = [
  { i: 1, n: "Light Wound", s: "Light", r: "1-2", c: "#ffd36b" },
  { i: 2, n: "Medium Wound", s: "Medium", r: "3-4", c: "#ffa24d" },
  { i: 3, n: "Critical Wound", s: "Critical", r: "5-6", c: "#ff6a4d" },
  { i: 4, n: "Down & KO'ed", s: "KO'ed", r: "7-8", c: "#ff3d6e" },
  { i: 5, n: "Dead", s: "Dead", r: "9+", c: "#ff2626" },
];
export const woundFor = (dmg) => dmg >= 9 ? 5 : dmg >= 7 ? 4 : dmg >= 5 ? 3 : dmg >= 3 ? 2 : dmg >= 1 ? 1 : 0;
export const BONUS_NAME = { melee: "Melee", ranged: "Ranged", offense: "Offense", spell: "Spell", power: "Power", smite: "Smite" }; // short: they label a number
// One Success Delta in plain words, used by the table card and Roll History.
// e: { att, def, at, dt, delta, db?, dbk?, sp?, ab? }
export function sdResult(e) {
  const hit = e.delta >= 0 && !e.dbl, known = e.db != null; // dbl: the attack hit an Optical Illusion Double
  const dmg = hit && known ? e.delta + e.db - (e.ab ?? 0) : null;
  const w = dmg != null ? woundFor(dmg) : 0;
  const headline = e.dbl ? "Hit the double!" : !hit ? "Miss" : dmg == null ? "Hit" : w ? WOUND_STEPS[w - 1].n : "Armor holds";
  const sub = e.dbl ? `It was ${e.def}'s illusion double. The attack misses` : !hit ? `${e.def} beats the attack by ${-e.delta}` : dmg == null ? `Add the ${e.dbk === "power" ? "power's" : "spell's"} Damage Bonus, then subtract the Armor Bonus`
    : w ? `${dmg} damage on the Vitality Track` : "Hit, but no damage gets through";
  return { hit, known, dmg, w, headline, sub, tie: e.delta === 0 };
}

// Loose name match for targets and defenders: "Raxx" matches "Raxx Veldt", case and extra spaces don't matter
export function sameName(a, b) {
  const x = String(a || "").toLowerCase().replace(/\s+/g, " ").trim(), y = String(b || "").toLowerCase().replace(/\s+/g, " ").trim();
  return !!x && !!y && (x === y || x.startsWith(y + " ") || y.startsWith(x + " "));
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

// Moving the turn (▶| / |◀ / END TURN). A monster group (e.g. Hive Runners ×3) keeps its members' names in `mem`
// (living ones, in card order): ▶| steps through them one at a time (st.sub) before moving on to the next spot.
const memOf = (e) => Array.isArray(e?.mem) ? e.mem : [];
export function initMove(md, d) {
  const st = md?.[INIT] || {}, list = initEntries(md); if (!list.length) return null;
  let i = list.findIndex(e => e.id === st.cur), round = st.round || 1, sub = st.sub || 0;
  if (i < 0) { i = d > 0 ? 0 : list.length - 1; sub = d > 0 ? 0 : Math.max(0, memOf(list[i]).length - 1); }
  else if (d > 0) { if (sub < memOf(list[i]).length - 1) sub++; else { i++; sub = 0; if (i >= list.length) { i = 0; round++; } } }
  else { if (sub > 0) sub--; else { i--; if (i < 0) { i = list.length - 1; round = Math.max(1, round - 1); } sub = Math.max(0, memOf(list[i]).length - 1); } }
  return { ...st, cur: list[i].id, sub, round, auto: 0 }; // a real step ends the automatic first turn (see autoFirst)
}
// Whose token it is now, and who's on deck (token names): a player's character, or the group member whose turn it is
export function turnNames(md) {
  const st = md?.[INIT]; if (!st?.open || !st.cur) return { cur: "", deck: "" };
  const list = initEntries(md), name = (s) => { const e = list.find(x => x.id === s?.cur); if (!e) return "";
    return e.pc ? e.name : memOf(e)[Math.min(s.sub || 0, memOf(e).length - 1)] || e.name; };
  const nx = initMove(md, 1), cur = name(st), deck = nx ? name(nx) : "";
  return { cur, deck: deck === cur ? "" : deck };
}

// Token conditions ("marks"): the list everyone can pick from, kept in room metadata
export const MARKS = "com.newscolos.marks";
export const MARK_ITEM = "com.newscolos.mark"; // metadata key on the label items stuck to tokens
export const DEFAULT_MARKS = ["Dead ☠️", "Unconscious 💤"];
export const markList = (md) => Array.isArray(md?.[MARKS]) ? md[MARKS] : DEFAULT_MARKS;

const head0 = (r, time, esc) => `<div class="hn">${esc(r.char || r.who)}${r.char ? ` <span class="pn">${esc(r.who)}</span>` : ""} <span class="t">${time}</span></div>`;
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
  if (r.sd) return sdLine(r, time, histDetail, esc);
  if (r.bs) r = { ...r, ap: "bullet stop" }; // the first Bullet Stop cards (Nov 24) used their own flag
  if (r.ap) { const pc = powerCard(r.ap, r.label);
    return `<div class="hl ap ${pc.c}">${head0(r, time, esc)}<div class="hr"><span class="hlbl">⚡ ${esc(pc.t)}${pc.s ? `: ${esc(pc.s)}` : ""}</span></div></div>`; }
  if (r.cop) return `<div class="hl cop">${head0(r, time, esc)}<div class="hr"><span class="hlbl">⚔ ${r.con ? `${esc(r.con)}${r.cos ? `: ${esc(r.cos)}` : ""}` : "Used a Combat Option Point"}</span><span class="tot">${r.max != null ? `${r.total}/${r.max}` : ""}</span></div></div>`;
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
// Success Delta in Roll History: who hit whom, the damage math as a row of numbers, and the wound it lands on.
function sdLine(e, time, detail, esc) {
  const R = sdResult(e), w = R.w ? WOUND_STEPS[R.w - 1] : null;
  const col = !R.hit ? "#9aa0b8" : w ? w.c : "#d5d9e8";
  const head = `<div class="hn">${esc(e.att)} <span class="sdvs">▸</span> ${esc(e.def)} <span class="t">${time}</span></div>`;
  const tag = `<span class="sdtag" style="color:${col};border-color:${col}">${esc(R.headline)}</span>`;
  const bk = (BONUS_NAME[e.dbk] || (e.sp ? "Spell" : "")) + " Damage Bonus";
  const math = !R.hit ? `<span class="sdeq">${fmt(e.at)} vs ${fmt(e.dt)} = <b>${e.delta}</b></span>`
    : R.dmg == null ? `<span class="sdeq"><b>${e.delta}</b> Δ + ? ${e.ab != null ? `− ${e.ab} armor bonus` : ""}</span>`
    : `<span class="sdeq"><b>${e.delta}</b> Δ + ${e.db} <small>${esc((BONUS_NAME[e.dbk] ? BONUS_NAME[e.dbk] + " " : "").toLowerCase())}damage bonus</small> − ${e.ab ?? 0} <small>armor bonus</small> = <b style="color:${col}">${R.dmg}</b></span>`;
  if (!detail) return `<div class="hl sd">${head}<div class="hr"><span class="sdic">Δ</span>${math}${tag}</div></div>`;
  const rows = [[`${esc(e.att)} <small>attack</small>`, fmt(e.at)], [`${esc(e.def)} <small>defense (Adroitness)</small>`, fmt(e.dt)],
    [`Success Delta <small>${R.tie ? "tie: attacker wins" : "attack − defense"}</small>`, String(e.delta)]];
  if (R.hit) { rows.push([`+ ${esc(bk)}`, e.db != null ? `+${e.db}` : "?"]); rows.push([`− ${esc(e.def)}'s Armor Bonus`, e.ab != null ? `−${e.ab}` : "?"]); }
  const table = rows.map(([k, v]) => `<div class="br"><span>${k}</span><b>${v}</b></div>`).join("") +
    `<div class="br res"><span>${R.hit ? (R.dmg != null ? "Damage" : "Damage <small>add the spell's bonus</small>") : "Result"}</span><b style="color:${col}">${R.hit ? (R.dmg ?? "?") : "Miss"}</b></div>` +
    (R.hit && R.dmg != null ? `<div class="br"><span>Vitality Track</span><b style="color:${col}">${w ? `${esc(w.n)} (${w.r})` : "No wound"}</b></div>` : "");
  return `<div class="hl sd det">${head}<div class="hr"><span class="sdic">Δ</span>${math}${tag}</div><div class="brk">${table}</div></div>`;
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
  .hl.cop { border-left:3px solid #4fc3f7; padding-left:5px; background:rgba(79,195,247,.08); } .hl.cop .hlbl, .hl.cop .tot { color:#7fd4ff; font-weight:800; }
  .hl.ap { border-left:3px solid #9d86ff; padding-left:5px; background:rgba(157,134,255,.1); } .hl.ap .hlbl { color:#c7b6ff; font-weight:800; }
  .hl.ap.ksa { border-left-color:#e04a3f; background:rgba(150,25,25,.2); } .hl.ap.ksa .hlbl { color:#ff6b5e; }
  .hl.ap.hv { border-left-color:#ff7ad9; background:rgba(255,122,217,.08); } .hl.ap.hv .hlbl { color:#ffb3ec; }
  .hl.ap.dm { border-left-color:#b3122e; background:rgba(179,18,46,.14); } .hl.ap.dm .hlbl { color:#ff4d6a; }
  .hl.ap.dp { border-left-color:#ffc94d; background:rgba(255,201,77,.08); } .hl.ap.dp .hlbl { color:#ffc94d; }
  .hl.ap.av { border-left-color:#e8b5ff; } .hl.ap.av .hlbl { color:#ffd9ff; }
  .hl.ap.ff { border-left-color:#3ee6ff; background:rgba(62,230,255,.08); } .hl.ap.ff .hlbl { color:#bff7ff; }
  .hl.ap.wr { border-left:3px dashed rgba(210,210,225,.5); background:rgba(255,255,255,.03); } .hl.ap.wr .hlbl { color:rgba(230,230,240,.6); font-style:italic; }
  .hl.ap.mm { border-left-color:#5ff0c8; background:rgba(95,240,200,.07); } .hl.ap.mm .hlbl { color:#a8ffe6; }
  .hl.ap.rv { border-left-color:#8a3fd1; background:rgba(90,20,130,.22); } .hl.ap.rv .hlbl { color:#c6ffd8; text-shadow:0 0 6px rgba(125,255,168,.6); }
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
  .hl.sd { border-left:3px solid #8f97ad; padding-left:5px; background:rgba(160,170,195,.07); }
  .hl .sdvs { color:var(--dim); font-weight:400; }
  .hl .sdic { flex:none; width:20px; height:20px; border-radius:5px; background:#3a3f50; color:#d5d9e8; font-weight:900; font-size:13px; display:flex; align-items:center; justify-content:center; }
  .hl .sdeq { flex:1; min-width:0; font-size:12px; font-weight:700; color:#b9bfd2; line-height:1.3; }
  .hl .sdeq b { color:#f1f3f9; } .hl .sdeq small { font-size:10px; font-weight:600; color:var(--dim); }
  .hl .sdtag { flex:none; margin-left:auto; font-size:10px; font-weight:900; letter-spacing:.5px; text-transform:uppercase; padding:2px 6px; border:1px solid; border-radius:10px; white-space:nowrap; }
  .histdet { width:100%; margin:4px 0 2px; padding:4px; font-size:11px; font-weight:800; border:1px solid #3a3d55; border-radius:6px; background:var(--paper); color:var(--dim); cursor:pointer; }
`;

// Roll log: the room only holds each player's last 10 rolls (Owlbear's room storage is tiny),
// so every browser also keeps its own copy of the last 200 rolls it has seen in this room.
// Every page calls this with the room's rolls; it merges them in (no duplicates) and returns the newest 200.
export const LOG_MAX = 200;
export function rollLog(roomId, roomRolls) {
  // one log per Owlbear room, so the 47th Precinct room and the main game never mix
  if (!roomId) { try { roomId = atob(new URLSearchParams(location.search).get("obrref") || "").split(" ")[1]; } catch {} }
  const key = "ns.rollLog@" + (roomId || "local");
  let log = [];
  try { log = JSON.parse(localStorage.getItem(key) || "[]"); if (!Array.isArray(log)) log = []; } catch { log = []; }
  // the GM cleared the history: drop what's older than that from this browser's log as well
  let c = roomRolls?.clr; try { if (c) localStorage.setItem(clrKey(roomId), JSON.stringify(c)); else c = JSON.parse(localStorage.getItem(clrKey(roomId)) || "null"); } catch {}
  let added = false;
  if (c) { const n = log.length; log = log.filter(r => !isCleared(r, c)); if (log.length !== n) added = true; roomRolls = (roomRolls || []).filter(r => !isCleared(r, c)); }
  const ids = new Set(log.map(r => r.id));
  for (const r of roomRolls || []) if (r?.id && !ids.has(r.id)) { log.push(r); ids.add(r.id); added = true; }
  log.sort((a, b) => b.ts - a.ts); log = log.slice(0, LOG_MAX);
  if (added) try { localStorage.setItem(key, JSON.stringify(log)); } catch {}
  return log;
}
