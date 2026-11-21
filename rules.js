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
  ...TYPES.map(t => [t.trim(), "tab:" + t]), ["The Gods", "gods"], ["Skill List", "tab:Skill List"]];
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
export async function sectionHtml(key) {
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
