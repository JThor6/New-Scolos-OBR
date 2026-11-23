// Shared by the RULES tab and the pop-out rules panel.
// Everything is read live from the Master character file, in Jake's own words.
const BRIDGE = "https://script.google.com/macros/s/AKfycbx5cjtXVGyFeoQx0EzJ-47gk4uXT6mXdgs90zaBmUB-zctUFm6OxD8fyWZWWuUQT0ua/exec";
const code = () => { try { return localStorage.getItem("ns.code") || ""; } catch { return ""; } };
export const esc2 = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
async function bridgeGet(params) {
  const u = new URL(BRIDGE); Object.entries({ code: code(), ...params }).forEach(([k, v]) => u.searchParams.set(k, v));
  return (await fetch(u)).json();
}
export const MASTER = "1_cnTDLNHIsaVMAOkOKSKK0YawUHt38ZewW1o5-yWbhU";
export const TYPES = ["Mercenary", "Hacker", "Revenant", "Subject Zero", "Wraith", "Mentalist", "Mage", "Priest"]; // easiest to hardest; the picker and REFERENCE list follow this order
export const SECTIONS = [["Your Turn & Movement", "turn"], ["Attacking & Damage", "attack"], ["Combat Options", "tab:Combat Options"],
  ["Skill List", "tab:Skill List"], ["Dice Odds", "odds"], ["The Gods", "gods"], ["Schools of Magic", "schools"], ...TYPES.map(t => [t.trim(), "tab:" + t]), ["New Scolos Rules Work in Progress", "wip"]];
// REFERENCE is shown in these groups (tab and pop-out dropdown). "__rolls" is Roll History.
export const REF_GROUPS = [
  ["Playing", ["__rolls", "turn", "attack", "tab:Combat Options", "odds"]],
  ["Lists", ["tab:Skill List", "gods", "schools"]],
  ["Character Types", TYPES.map(t => "tab:" + t)],
  ["Draft Rules WIP", ["wip"]],
];
const tabCache = {};
const saved = {
  get: (k) => { try { return JSON.parse(localStorage.getItem("ns.cache.rules." + k) || "null"); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem("ns.cache.rules." + k, JSON.stringify(v)); } catch {} },
};
// Show the saved copy instantly; fetch a fresh one in the background for next time
async function fetchTab(id, tab, key) {
  const r = await bridgeGet(tab ? { id, tab } : { id });
  if (!r.ok) throw new Error(r.error);
  saved.set(key, r.values); tabCache[key] = r.values; return r.values;
}
export async function getTab(tab) {
  if (tabCache[tab]) return tabCache[tab];
  const id = MASTER, t = tab === "Main Sheet" ? "" : tab, old = saved.get(tab);
  if (old) { tabCache[tab] = old; fetchTab(id, t, tab).catch(() => {}); return old; }
  return fetchTab(id, t, tab);
}
// Easier reading: things a player spends points on (Healing (1 invocation), Big (2 SP, difficulty +2)) get a card with the
// cost as a tag; ALL-CAPS labels (CASTING A SPELL) become section headings with their text under them.
const COST = /^(.*?)\s*\(([^)]*\b\d+\s*(?:invocations?|SP)\b[^)]*)\)\s*$/i;
const CAPS = (t) => t.length > 3 && /[A-Z]/.test(t) && t === t.toUpperCase();
function rowsHtml(values) {
  return values.map(row => row.map(c => String(c).trim()).filter(Boolean)).filter(c => c.length).map(c => {
    if (c.length === 1) return c[0].length < 40 ? `<div class="rh">${esc2(c[0])}</div>` : `<div class="rr">${esc2(c[0])}</div>`;
    const label = c.slice(0, -1).join(" · "), text = c[c.length - 1], m = label.match(COST);
    if (CAPS(label)) return `<div class="rh">${esc2(label)}</div><div class="rr">${esc2(text)}</div>`;
    if (m) return `<div class="rr act"><b>${esc2(m[1])} <span class="cost">${esc2(m[2])}</span></b>${esc2(text)}</div>`;
    return `<div class="rr ${/^extraordinary power/i.test(label) ? "ep" : ""}"><b>${esc2(label)}</b>${esc2(text)}</div>`;
  }).join("");
}
// Column K on the Main Sheet is an outline: the first line after a blank row (and any line ending in ":") is a heading,
// everything else is a bullet. Keeps every line the same size instead of guessing from length.
function outlineHtml(lines) {
  let html = "", start = true;
  for (const raw of lines) {
    const t = String(raw || "").trim();
    if (!t) { start = true; continue; }
    if (start || /:$/.test(t)) html += `<div class="oh">${esc2(t.replace(/:$/, ""))}</div>`;
    else html += `<div class="ol">${esc2(t)}</div>`;
    start = false;
  }
  return `<div class="ow">${html}</div>`;
}
function col(values, letter, from, to) { const i = letter.charCodeAt(0) - 65; const out = []; for (let r = from; r <= to; r++) out.push([values[r - 1]?.[i] || ""]); return out; }
const DICE_ODDS = "1wLo5GU3ONGhv8PvGhQopZzPBAJZZSzClj0-RnwlX8SE"; // "New Scolos Dice Odds" sheet in the character folder
let oddsCache = null;
async function oddsHtml() {
  if (!oddsCache) { const old = saved.get("odds"); if (old) { oddsCache = old; bridgeGet({ id: DICE_ODDS, tab: "Dice Odds" }).then(r => r.ok && saved.set("odds", r.values)).catch(() => {}); } else { const r = await bridgeGet({ id: DICE_ODDS, tab: "Dice Odds" }); if (!r.ok) throw new Error(r.error); oddsCache = r.values; saved.set("odds", r.values); } }
  const v = oddsCache, cell = (row, col) => String(v[row]?.[col] ?? "").trim();
  const hdr = v.findIndex(row => /^\s*your skill total\s*$/i.test(row[1] || "")); // the header cell itself, not the intro sentence
  let html = cell(2, 1) ? `<div class="rr">${esc2(cell(2, 1))}</div>` : "";
  if (hdr >= 0) {
    // header row: difficulties start in column C; find the last filled column
    const cols = []; for (let c = 2; c < (v[hdr]?.length || 0); c++) { if (!cell(hdr, c)) break; cols.push(c); }
    const rows = []; for (let r = hdr + 1; r < v.length; r++) { if (!/^[+\-−]?\d/.test(cell(r, 1))) break; rows.push(r); }
    const heat = (t) => { const p = parseFloat(t); if (isNaN(p)) return ""; return p >= 90 ? "o5" : p >= 70 ? "o4" : p >= 50 ? "o3" : p >= 25 ? "o2" : p >= 10 ? "o1" : "o0"; };
    if (cols.length && rows.length) {
      html += `<div class="rh">Chance to succeed · skill total ↓ vs difficulty →</div><div class="oddsw"><table class="odds"><tr><th></th>${cols.map(c => `<th>${esc2(cell(hdr, c))}</th>`).join("")}</tr>`;
      for (const r of rows) html += `<tr><th>${esc2(cell(r, 1))}</th>${cols.map(c => `<td class="${heat(cell(r, c))}">${esc2(cell(r, c).replace(".0%", "%"))}</td>`).join("")}</tr>`;
      html += `</table></div>`;
    } else html += `<div class="rr err">Couldn't read the odds chart (found ${cols.length} columns, ${rows.length} rows).</div>`;
  } else html += `<div class="rr err">Couldn't find the odds chart in the Dice Odds sheet.</div>`;
  const diff = v.findIndex(row => /setting the difficulty/i.test(row[1] || ""));
  if (diff >= 0) {
    html += `<div class="rh">Setting the difficulty</div>`;
    for (let r = diff + 2; r < v.length && cell(r, 1); r++) html += `<div class="rr"><b>${esc2(cell(r, 1))} · ${esc2(cell(r, 2))}</b>${esc2(cell(r, 5))}</div>`;
  }
  return html;
}

export async function sectionHtml(key) {
  if (key === "wip") return wipHtml();
  if (key === "odds") return oddsHtml();
  if (key.startsWith("tab:")) {
    const v = await getTab(key.slice(4));
    if (key.includes("Priest")) { const g = v.findIndex(r => r.join("").trim() === "THE GODS"); return rowsHtml(g > 0 ? v.slice(0, g) : v); }
    return rowsHtml(v);
  }
  if (key === "schools") { // the chart on the Mage tab: one school per row (name, what it is, suggested verbs), ends at a blank row
    const v = await getTab("Mage"), t = (r, i) => String(r?.[i] ?? "").trim(), h = v.findIndex(r => /^schools of magic$/i.test(t(r, 1)));
    if (h < 0) return "<div class='rr'>No schools list found on the Mage tab.</div>";
    let html = "<div class='rr'>Mages pick a Major school (small, big or huge spells) and a Minor school (small spells only). Spells use the school's verbs.</div>";
    for (let r = h + 1; r < v.length && t(v[r], 1); r++) html += `<div class="rr"><b>${esc2(t(v[r], 1))}</b>${esc2(t(v[r], 2))}${t(v[r], 3) ? `<br><span style="color:#9aa0b8">Verbs: ${esc2(t(v[r], 3))}</span>` : ""}</div>`;
    return html;
  }
  if (key === "gods") { const v = await getTab("Priest"); const g = v.findIndex(r => r.join("").trim() === "THE GODS"); return g > 0 ? rowsHtml(v.slice(g + 1)) : "<div class='rr'>No gods list found.</div>"; }
  const m = await getTab("Main Sheet");
  // Rules panel on the right of the Main Sheet (column K): During Your Turn, then Combat Rules onward
  const K = m.map(r => String(r?.[10] ?? "").trim()), turn = K.indexOf("During Your Turn"), combat = K.indexOf("Combat Rules");
  if (turn >= 0 && combat > turn) {
    return key === "turn" ? outlineHtml(K.slice(turn + 1, combat)) : outlineHtml(K.slice(combat));
  }
  if (key === "turn") return rowsHtml(col(m, "G", 46, 56)); // older layout
  return rowsHtml([...col(m, "B", 57, 70), ...col(m, "G", 57, 60), ...col(m, "E", 61, 70)]);
}

// ---------- Rules Work in Progress: Jake's rules draft Google Doc, read live through the bridge ----------
// Little tabs across the top: one per tab of the doc (if it has more than one), then one per heading section.
// Tap one to show just that part; ALL shows the whole thing.
if (typeof document !== "undefined" && !document.getElementById("wipcss")) {
  document.head.insertAdjacentHTML("beforeend", `<style id="wipcss">
  .wip { font-size:13px; line-height:1.45; }
  .wipnote { margin:2px 0 8px; padding:6px 9px; border-left:3px solid #5b3f9e; border-radius:6px; background:rgba(60,38,110,.45); color:#c9bde6; font-size:11px; line-height:1.4; }
  .wipnote b { display:block; color:#bb99ff; font-size:10px; letter-spacing:.6px; text-transform:uppercase; margin-bottom:1px; }
  .wiptabs { display:flex; flex-wrap:wrap; gap:4px; padding:2px 0 8px; }
  .wipchip { border:2px solid #444a66; background:rgba(15,17,28,.55); color:#f1f3f9; border-radius:7px; padding:3px 8px; font-size:11px; font-weight:800; cursor:pointer; }
  .wipchip.on { background:#bb99ff; color:#000; border-color:#000; }
  .wipsec[hidden] { display:none !important; }
  .wip h3 { margin:12px 0 4px; font-family:'Bangers', Impact, sans-serif; font-weight:400; letter-spacing:1px; color:#bb99ff; font-size:19px; }
  .wip h4 { margin:10px 0 3px; color:#bb99ff; font-size:14px; } .wip h5 { margin:8px 0 2px; font-size:13px; }
  .wip p { margin:0 0 7px; }
  .wip ul { margin:0 0 7px; padding-left:18px; } .wip li { margin:2px 0; }
  .wip .tw { overflow-x:auto; margin:4px 0 9px; }
  .wip table { border-collapse:collapse; font-size:11px; min-width:100%; }
  .wip td { border:1px solid #444a66; padding:3px 5px; vertical-align:top; }
  .wip tr:first-child td { font-weight:800; background:rgba(187,153,255,.15); }
  </style>`);
  document.addEventListener("click", (e) => {
    const chip = e.target.closest(".wipchip"); if (!chip) return;
    e.preventDefault();
    const box = chip.closest(".wip"), want = chip.dataset.s;
    box.querySelectorAll(".wipchip").forEach(c => c.classList.toggle("on", c === chip));
    box.querySelectorAll(".wipsec").forEach(sec => { sec.hidden = want !== "all" && !sec.dataset.s.split(" ").includes(want); });
  });
}
function runsHtml(r) {
  return (r || []).map(([t, b, i]) => { let h = esc2(t).replace(/\n|\v|\r/g, "<br>"); if (b) h = `<b>${h}</b>`; if (i) h = `<i>${h}</i>`; return h; }).join("");
}
function wipRender(d) {
  const multi = d.tabs.length > 1, chips = [`<button class="wipchip on" data-s="all">ALL</button>`];
  let body = "", n = 0;
  d.tabs.forEach((tab, ti) => {
    const tk = "t" + ti;
    if (multi) chips.push(`<button class="wipchip" data-s="${tk}">${esc2(tab.title)}</button>`);
    // split the tab into sections at its top headings
    const top = Math.min(...tab.blocks.filter(b => b.h).map(b => b.h), 9);
    let sec = [], key = "";
    const flush = () => { if (sec.length) body += `<div class="wipsec" data-s="${tk}${key ? " " + key : ""}">${sec.join("")}</div>`; sec = []; };
    let list = [];
    const endList = () => { if (list.length) { sec.push(`<ul>${list.join("")}</ul>`); list = []; } };
    for (const b of tab.blocks) {
      if (b.li) { list.push(`<li style="margin-left:${(b.n || 0) * 14}px">${runsHtml(b.li)}</li>`); continue; }
      endList();
      if (b.h) {
        const text = b.r.map(x => x[0]).join("").trim();
        if (b.h === top) { flush(); key = "s" + (n++); chips.push(`<button class="wipchip" data-s="${key}">${esc2(text)}</button>`); }
        sec.push(`<h${Math.min(b.h + 2, 5)}>${esc2(text)}</h${Math.min(b.h + 2, 5)}>`);
      } else if (b.p) sec.push(`<p>${runsHtml(b.p)}</p>`);
      else if (b.t) sec.push(`<div class="tw"><table>${b.t.map(r => `<tr>${r.map(c => `<td>${esc2(c).replace(/\n/g, "<br>")}</td>`).join("")}</tr>`).join("")}</table></div>`);
    }
    endList(); flush();
  });
  return `<div class="wip"><div class="wipnote"><b>Rules in progress</b>New Scolos is being rewritten, so this draft is unfinished and changing. Where it disagrees with an older sheet or document, the rules in this extension are the most current.</div>` +
    `<div class="wiptabs">${chips.join("")}</div>${body || "<div class='rr'>The rules draft is empty.</div>"}</div>`;
}
// Markdown from the bridge → the same blocks wipRender draws: {h, r} {p} {li, n} {t}
function mdInline(t) {
  t = t.replace(/\\([\\`*_{}\[\]()#+\-.!|>~<=])/g, "$1"); // Docs escapes symbols like \- and \+
  const out = []; let re = /(\*\*\*|\*\*|\*|__|_)(.+?)\1/g, last = 0, m;
  while ((m = re.exec(t))) {
    if (m.index > last) out.push([t.slice(last, m.index), false, false]);
    const k = m[1]; out.push([m[2], k.length >= 2 && k !== "_", k === "*" || k === "_" || k === "***"]); last = re.lastIndex;
  }
  if (last < t.length) out.push([t.slice(last), false, false]);
  return out.map(([x, b, i]) => [x.replace(/\\([*_])/g, "$1"), b, i]);
}
function mdBlocks(md) {
  const lines = String(md || "").replace(/\r/g, "").split("\n"), blocks = []; let para = [], table = null;
  const flushP = () => { if (para.length) { blocks.push({ p: mdInline(para.join(" ")) }); para = []; } };
  const flushT = () => { if (table) { blocks.push({ t: table }); table = null; } };
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    if (/^\s*\|.*\|\s*$/.test(line)) { // table row
      flushP();
      const cells = line.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map(c => mdInline(c.trim().replace(/<br\s*\/?>/gi, "\n")).map(x => x[0]).join(""));
      if (cells.every(c => /^:?-{2,}:?$/.test(c.trim()))) continue; // the |---|---| line
      (table = table || []).push(cells); continue;
    }
    flushT();
    if (!line.trim()) { flushP(); continue; }
    let m;
    if ((m = line.match(/^(#{1,6})\s+(.*)$/))) { flushP(); blocks.push({ h: m[1].length, r: mdInline(m[2].replace(/\s*#+\s*$/, "")) }); continue; }
    if ((m = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/))) { flushP(); blocks.push({ li: mdInline(m[3]), n: Math.floor(m[1].replace(/\t/g, "    ").length / 2) }); continue; }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { flushP(); continue; }
    para.push(line.trim());
  }
  flushP(); flushT();
  return blocks;
}
const wipData = (r) => r.md != null ? { tabs: [{ title: r.title || "Rules", blocks: mdBlocks(r.md) }] } : r;
async function wipFetch() {
  const r = await bridgeGet({ doc: "rules" });
  if (!r.ok) throw new Error(r.error);
  saved.set("wip", r); return r;
}
async function wipHtml() {
  const old = saved.get("wip");
  if (old) { wipFetch().catch(() => {}); return wipRender(wipData(old)); } // saved copy right away, fresh one for next time
  try { return wipRender(wipData(await wipFetch())); }
  catch (e) { throw new Error(`${e.message || e} (if this is new, the Sheet Bridge needs its update)`); }
}
