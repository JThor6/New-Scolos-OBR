/**
 * New Scolos Sheet Bridge — lets the Owlbear add-on read a character's Main Sheet
 * and update three live-play things: vitality track, Extraordinary Power used today, COP spent.
 *
 * Owned and deployed by Jake as a web app ("Execute as: Me", "Who has access: Anyone").
 * Only works on sheets inside the New Scolos character folder, and only with the table code.
 */

const TABLE_CODE = 'CHANGE-ME';                          // pick a code; players type it once in Owlbear
const CHARACTER_FOLDER_ID = '1AGoMytVf6xI8DWzMewiEtZF65M9kie88';
// Folders the bridge may open: characters, plus the GM's encounter sheets
const ENCOUNTER_FOLDER_ID = '1UQ_Zq4skyRzjUcaly95g98C2figf6tQs';
const ALLOWED_FOLDER_IDS = [CHARACTER_FOLDER_ID, ENCOUNTER_FOLDER_ID];
const TRACKER_TAB = 'Extension Tracker';
const WOUND_CELLS = ['B16', 'C16', 'D16', 'E16', 'F16', 'G16', 'H16'];
const POWER_CELL = 'F6';
const COP_SPENT_CELL = 'H29';
const POINTS_LABEL_CELL = 'E13'; // says "Invocations" or "Spell Points" when the character has them
const POINTS_CELL = 'F13';
// Sheet Manager: the only Main Sheet cells it may write (never formulas).
// Sections are found by their headings in column B, so sheets with extra rows still work.
function manageCells(sh) {
  const grid = sh.getRange('B1:G300').getDisplayValues();
  const b = grid.map(function (r) { return String(r[0]).trim().toLowerCase(); });
  const at = function (label, from) { for (let i = from || 0; i < b.length; i++) if (b[i] === label) return i + 1; return 0; };
  const tr = at('trained skills'), ut = at('untrained skills', tr), inv = at('inventory', ut);
  if (tr && ut && inv && b[6] === 'adroitness' && b[9] === 'charm' && String(grid[inv - 1][5]).trim().toLowerCase() === 'notes') {
    // current layout: Inventory (B-D) | Equipped (E) | Notes (G) side by side, as many rows as needed
    return [['F', 'F', 3, 4], ['F', 'F', 7, 7], ['F', 'F', 10, 10], ['C', 'C', 7, 10],
      ['B', 'C', tr + 1, ut - 1], ['E', 'E', tr + 1, ut - 1], ['B', 'C', ut + 1, inv - 1], ['E', 'E', ut + 1, inv - 1],
      ['B', 'E', inv + 1, 300], ['G', 'G', inv + 1, 300]];
  }
  const cr = at('combat rules', inv), notes = at('notes', cr); // older layout
  if (!tr || !ut || !inv || !cr || !notes || b[6] !== 'adroitness' || b[9] !== 'charm') throw new Error('Could not find the sheet sections (Trained Skills, Untrained Skills, Inventory, Combat Rules, Notes), so the manager will not write to it.');
  return [ // [first col, last col, first row, last row]
    ['F', 'F', 3, 4], ['F', 'F', 7, 7], ['F', 'F', 10, 10], // XP, credits, spent attribute points
    ['C', 'C', 7, 10],                                      // attributes
    ['B', 'C', tr + 1, ut - 1], ['E', 'E', tr + 1, ut - 1], // trained skills
    ['B', 'C', ut + 1, inv - 1], ['E', 'E', ut + 1, inv - 1], // untrained skills
    ['B', 'D', inv + 1, cr - 1], ['E', 'E', inv + 1, cr - 1], // inventory, equipped
    ['B', 'B', notes + 1, notes + 30],                       // notes
  ];
}
function manageAllowed(list, a1) {
  const m = /^([A-L])(\d+)$/.exec(a1); if (!m) return false;
  const c = m[1], n = Number(m[2]);
  return list.some(function (x) { return c >= x[0] && c <= x[1] && n >= x[2] && n <= x[3]; });
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function openMain(id) {
  const file = DriveApp.getFileById(id);
  const parents = file.getParents();
  let ok = false;
  while (parents.hasNext()) if (ALLOWED_FOLDER_IDS.indexOf(parents.next().getId()) >= 0) ok = true;
  if (!ok) throw new Error('That sheet is not in a New Scolos folder the bridge can use.');
  const ss = SpreadsheetApp.openById(id);
  return ss.getSheetByName('Main Sheet') || ss.getSheets()[0];
}

// GET ?code=...&id=SHEET_ID        -> the Main Sheet (display values, A1:L60)
// GET ?code=...&id=SHEET_ID&tab=Priest -> that whole tab
// GET ?code=...&list=1             -> every character sheet in the folder (for the GM)
function doGet(e) {
  try {
    const p = e.parameter;
    if (p.code !== TABLE_CODE) return json({ ok: false, error: 'Wrong table code.' });
    if (p.list === 'encounters') { // every encounter sheet in the encounter folder, newest edited first
      const out = [], it = DriveApp.getFolderById(ENCOUNTER_FOLDER_ID).getFilesByType(MimeType.GOOGLE_SHEETS);
      while (it.hasNext()) { const f = it.next(); out.push({ id: f.getId(), name: f.getName(), t: f.getLastUpdated().getTime() }); }
      out.sort(function (a, b) { return b.t - a.t; });
      return json({ ok: true, sheets: out });
    }
    if (p.list) {
      const out = [], it = DriveApp.getFolderById(CHARACTER_FOLDER_ID).getFilesByType(MimeType.GOOGLE_SHEETS);
      while (it.hasNext()) { const f = it.next(); out.push({ id: f.getId(), name: f.getName() }); }
      return json({ ok: true, sheets: out });
    }
    if (p.tab) { // a whole tab, e.g. Combat Options or Priest (used by the Rules tab)
      openMain(p.id); // folder check
      const t = SpreadsheetApp.openById(p.id).getSheetByName(p.tab);
      if (!t) throw new Error('No tab named ' + p.tab);
      const last = Math.min(t.getLastRow(), 200), cols = Math.min(t.getLastColumn(), 20);
      return json({ ok: true, values: last ? t.getRange(1, 1, last, cols).getDisplayValues() : [] });
    }
    const sh = openMain(p.id);
    return json({ ok: true, values: sh.getRange('A1:L300').getDisplayValues() });
  } catch (err) {
    return json({ ok: false, error: String(err.message || err) });
  }
}

// POST body (text/plain JSON): {code, id, wound: 0-6, on: true/false} or {code, id, power: true/false} or {code, id, copSpent: n} or {code, id, points: n}
function doPost(e) {
  try {
    const b = JSON.parse(e.postData.contents);
    if (b.code !== TABLE_CODE) return json({ ok: false, error: 'Wrong table code.' });
    const sh = openMain(b.id);
    if (b.tracker) { // GM monster tracker: wound boxes (columns M-S) and Dead (column T) on the Extension Tracker tab
      const t = SpreadsheetApp.openById(b.id).getSheetByName(TRACKER_TAB);
      if (!t) throw new Error('No tab named ' + TRACKER_TAB);
      const row = Math.round(Number(b.row)), col = Math.round(Number(b.col));
      if (!(row >= 4 && row <= 200 && col >= 13 && col <= 20)) throw new Error('That cell is not a wound or Dead box.');
      t.getRange(row, col).setValue(b.on ? (col === 20 ? true : 'X') : '');
      return json({ ok: true });
    }
    if (b.cells) { // Sheet Manager: several input cells at once
      const keys = Object.keys(b.cells);
      if (!keys.length || keys.length > 250) throw new Error('Nothing to change.');
      const allowed = manageCells(sh);
      keys.forEach(function (k) { if (!manageAllowed(allowed, k)) throw new Error('The manager cannot change ' + k + '.'); });
      const lock = LockService.getScriptLock(); lock.waitLock(10000);
      try {
        keys.forEach(function (k) {
          let v = b.cells[k];
          if (typeof v === 'number') { if (!isFinite(v)) throw new Error('Bad number for ' + k); }
          else { v = String(v == null ? '' : v).slice(0, 300); if (/^[=@]/.test(v)) v = "'" + v; } // text stays text
          const cell = sh.getRange(k);
          if (cell.getFormula()) cell.setFormula(''); // a typed constant like =2 becomes a plain value
          cell.setValue(v);
        });
      } finally { lock.releaseLock(); }
      return json({ ok: true });
    }
    if (b.wound !== undefined) {
      const cell = WOUND_CELLS[Number(b.wound)];
      if (!cell) throw new Error('Bad wound box.');
      sh.getRange(cell).setValue(b.on ? 'X' : '');
    } else if (b.power !== undefined) {
      sh.getRange(POWER_CELL).setValue(!!b.power);
    } else if (b.points !== undefined) { // Invocations (Priest) or Spell Points (Mage), F13
      if (!String(sh.getRange(POINTS_LABEL_CELL).getDisplayValue()).trim()) throw new Error('This character has no invocations or spell points.');
      const n = Math.max(0, Math.min(50, Math.round(Number(b.points) || 0)));
      sh.getRange(POINTS_CELL).setValue(n);
    } else if (b.copSpent !== undefined) {
      const n = Math.max(0, Math.min(20, Math.round(Number(b.copSpent) || 0)));
      sh.getRange(COP_SPENT_CELL).setValue(n);
    } else {
      throw new Error('Nothing to change.');
    }
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err.message || err) });
  }
}
