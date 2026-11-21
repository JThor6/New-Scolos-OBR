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
export const TYPES = ["Priest", "Mage", "Mentalist", "Mercenary ", "Wraith", "Revenant", "Hacker", "Subject Zero"];
export const SECTIONS = [["Your Turn & Movement", "turn"], ["Attacking & Damage", "attack"], ["Combat Options", "tab:Combat Options"],
  ...TYPES.map(t => [t.trim(), "tab:" + t]), ["The Gods", "gods"], ["Skill List", "tab:Skill List"], ["Dice Odds", "odds"]];
const tabCache = {};
export async function getTab(tab) {
  if (!tabCache[tab]) {
    const r = await bridgeGet(tab === "Main Sheet" ? { id: MASTER } : { id: MASTER, tab });
    if (!r.ok) throw new Error(r.error);
    tabCache[tab] = r.values;
  }
  return tabCache[tab];
}
function rowsHtml(values) {
  return values.map(row => row.map(c => String(c).trim()).filter(Boolean)).filter(c => c.length).map(c =>
    c.length === 1 ? (c[0].length < 40 ? `<div class="rh">${esc2(c[0])}</div>` : `<div class="rr">${esc2(c[0])}</div>`)
    : `<div class="rr ${/^extraordinary power/i.test(c[0]) ? "ep" : ""}"><b>${esc2(c.slice(0, -1).join(" · "))}</b>${esc2(c[c.length - 1])}</div>`).join("");
}
function col(values, letter, from, to) { const i = letter.charCodeAt(0) - 65; const out = []; for (let r = from; r <= to; r++) out.push([values[r - 1]?.[i] || ""]); return out; }
const DICE_ODDS = "1wLo5GU3ONGhv8PvGhQopZzPBAJZZSzClj0-RnwlX8SE"; // "New Scolos Dice Odds" sheet in the character folder
let oddsCache = null;
async function oddsHtml() {
  if (!oddsCache) { const r = await bridgeGet({ id: DICE_ODDS, tab: "Dice Odds" }); if (!r.ok) throw new Error(r.error); oddsCache = r.values; }
  const v = oddsCache, cell = (row, col) => String(v[row]?.[col] ?? "").trim();
  const hdr = v.findIndex(row => /your skill total/i.test(row[1] || ""));
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
    const key = []; for (let r = hdr; r < hdr + 12; r++) if (cell(r, 14) && !/color key/i.test(cell(r, 14))) key.push(cell(r, 14));
    if (key.length) html += `<div class="rh">Color key</div>` + key.map(k => `<div class="rr">${esc2(k)}</div>`).join("");
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
  if (key === "gods") { const v = await getTab("Priest"); const g = v.findIndex(r => r.join("").trim() === "THE GODS"); return g > 0 ? rowsHtml(v.slice(g + 1)) : "<div class='rr'>No gods list found.</div>"; }
  const m = await getTab("Main Sheet");
  if (key === "turn") return rowsHtml(col(m, "G", 46, 56));
  return rowsHtml([...col(m, "B", 57, 70), ...col(m, "G", 57, 60), ...col(m, "E", 61, 70)]);
}
