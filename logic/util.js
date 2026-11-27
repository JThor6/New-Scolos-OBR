// Small text and number helpers used everywhere. Pure: no page, no Owlbear, no storage.
export const num = (s) => { const n = parseInt(String(s ?? "").replace(/[,\s+]/g, "").replace("−", "-"), 10); return isNaN(n) ? null : n; };
export const sgn = (n) => (n > 0 ? "+" : "") + n;
export const nm = (x) => String(x || "").toLowerCase().replace(/\s+/g, " ").trim();
// Title case that leaves small joining words alone ("Knowledge of the Void")
const SMALL_WORDS = new Set(["of", "and", "the", "a", "an", "to", "in", "on", "for", "with", "or", "at", "by"]);
export const tc = (s) => String(s ?? "").replace(/[A-Za-z][A-Za-z']*/g, (w, i) => (i > 0 && SMALL_WORDS.has(w.toLowerCase()) && w === w.toLowerCase()) ? w : w[0].toUpperCase() + w.slice(1));
// One cell of a sheet's values (rows of columns) by its A1 name: pCell(v, "C3")
export const pCell = (v, a1) => { const m = a1.match(/^([A-L])(\d+)$/); return String(v?.[+m[2] - 1]?.[m[1].charCodeAt(0) - 65] ?? "").trim(); };
