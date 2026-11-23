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
  ["Skill List", "tab:Skill List"], ["The Gods", "gods"], ["Schools of Magic", "schools"], ...TYPES.map(t => [t.trim(), "tab:" + t]), ["Dice Odds", "odds"]];
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
function rowsHtml(values) {
  return values.map(row => row.map(c => String(c).trim()).filter(Boolean)).filter(c => c.length).map(c =>
    c.length === 1 ? (c[0].length < 40 ? `<div class="rh">${esc2(c[0])}</div>` : `<div class="rr">${esc2(c[0])}</div>`)
    : `<div class="rr ${/^extraordinary power/i.test(c[0]) ? "ep" : ""}"><b>${esc2(c.slice(0, -1).join(" · "))}</b>${esc2(c[c.length - 1])}</div>`).join("");
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
