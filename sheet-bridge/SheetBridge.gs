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
const MASTER_ID = '1_cnTDLNHIsaVMAOkOKSKK0YawUHt38ZewW1o5-yWbhU'; // Master New Scolos File for Characters
const TYPE_TABS = ['Priest', 'Mage', 'Mentalist', 'Mercenary', 'Wraith', 'Revenant', 'Hacker', 'Subject Zero'];
const ATTR_COST = { '-3': 0, '-2': 1, '-1': 3, '0': 7, '1': 14, '2': 25, '3': 41 }; // Starting Attribute Calculator, 42 points
const START_LEVELS = [1, 0, 0, 0, -2, -2, -3, -3];                              // Skill List: starting skill levels

// Character Generator: copy the Master into the characters folder and fill it in
function createCharacter(c) {
  const name = String(c.name || '').trim().slice(0, 60);
  if (!name) throw new Error('Give the character a name.');
  const type = String(c.type || '').trim();
  if (TYPE_TABS.indexOf(type) < 0) throw new Error('Pick a character type.');
  const A = ['Adroitness', 'Raw Strength', 'Intellect', 'Charm'];
  let cost = 0;
  A.forEach(function (a) { const r = Math.round(Number(c.attrs && c.attrs[a])); if (!(r >= -3 && r <= 3)) throw new Error('Attributes go from -3 to +3.'); cost += ATTR_COST[String(r)]; });
  if (cost > 42) throw new Error('Attributes cost ' + cost + ' points; you only have 42.');
  const skills = (c.skills || []).map(function (s) { return { name: String(s.name || '').trim().slice(0, 60), attr: String(s.attr || ''), level: Math.round(Number(s.level)) }; });
  if (skills.length !== 8 || skills.some(function (s) { return !s.name || A.indexOf(s.attr) < 0; })) throw new Error('Pick 8 skills, each with an attribute.');
  const lv = skills.map(function (s) { return s.level; }).sort().join(), want = START_LEVELS.slice().sort().join();
  if (lv !== want) throw new Error('Starting skill levels must be one +1, three 0, two -2 and two -3.');
  if (skills.some(function (s) { return /^prayer/i.test(s.name); }) && type !== 'Priest') throw new Error('Prayer is for Priests only.');
  if (skills.some(function (s) { return /^spellcasting/i.test(s.name); }) && type !== 'Mage') throw new Error('Spellcasting is for Mages only.');
  const xp = Math.max(0, Math.min(1000, Math.round(Number(c.xp) || 0)));
  const email = String(c.email || '').trim();
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('That email does not look right.');

  const folder = DriveApp.getFolderById(CHARACTER_FOLDER_ID);
  const file = DriveApp.getFileById(MASTER_ID).makeCopy(name, folder);
  const ss = SpreadsheetApp.openById(file.getId());
  const sh = ss.getSheetByName('Main Sheet');
  const text = function (v) { v = String(v == null ? '' : v); return /^[=@+\-]/.test(v) && isNaN(Number(v)) ? "'" + v : v; };
  sh.getRange('C3').setValue(text(name)); sh.getRange('C4').setValue(type); sh.getRange('C5').setValue(text(c.power || ''));
  A.forEach(function (a, i) { sh.getRange('C' + (7 + i)).setValue(Math.round(Number(c.attrs[a]))); });
  sh.getRange('F3').setValue(xp); sh.getRange('F4').setValue(0); sh.getRange('F6').setValue(false); sh.getRange('F7').setValue(1000); sh.getRange('F10').setValue(0);
  // skills, best first, into the Trained Skills rows
  const col = sh.getRange('B1:B60').getDisplayValues().map(function (r) { return String(r[0]).trim().toLowerCase(); });
  const tr = col.indexOf('trained skills') + 1;
  if (!tr) throw new Error('The Master sheet has no Trained Skills section.');
  skills.sort(function (a, b) { return b.level - a.level; }).forEach(function (s, i) {
    sh.getRange('B' + (tr + 1 + i)).setValue(text(s.name)); sh.getRange('C' + (tr + 1 + i)).setValue(s.attr); sh.getRange('E' + (tr + 1 + i)).setValue(s.level);
  });
  // equipment: armor +2 Defense, melee +2 Offense (+ Raw Str), ranged +4 Offense; formulas follow Raw Strength later
  const eq = c.equip || {}, inv = col.indexOf('inventory') + 1 || 45;
  sh.getRange('H23').setFormula(eq.melee ? '=MAX(0,2+C8)' : '=MAX(0,C8)');
  sh.getRange('H24').setValue(eq.ranged ? 4 : 0);
  sh.getRange('H25').setFormula(eq.armor ? '=MAX(1,2+C8)' : '=MAX(0,C8)');
  const equipped = [];
  if (eq.armor) equipped.push(text(eq.armor) + ' (+2 Defense Rating)');
  if (eq.melee) equipped.push(text(eq.melee) + ' (+2 Offense Rating)');
  if (eq.ranged) equipped.push(text(eq.ranged) + ' (+4 Offense Rating)');
  equipped.forEach(function (e, i) { sh.getRange('E' + (inv + 1 + i)).setValue(e); });
  (c.gear || []).slice(0, 100).forEach(function (g, i) { sh.getRange('B' + (inv + 1 + i)).setValue(text(String(g).slice(0, 200))); });
  (c.notes || []).slice(0, 100).forEach(function (n, i) { sh.getRange('G' + (inv + 1 + i)).setValue(text(String(n).slice(0, 300))); });
  // Priest invocations / Mage spell points (max follows level)
  if (type === 'Priest') sh.getRange('E13:H13').setValues([['Invocations', 2, 'Max Invocations', '=2+ROUNDDOWN(F5/2)']]);
  else if (type === 'Mage') sh.getRange('E13:H13').setValues([['Spell Points', 3, 'Max Spell Points', '=3+ROUNDDOWN(F5/2)']]);
  else sh.getRange('E13:H13').clearContent();
  // keep only this character's type tab
  ss.getSheets().forEach(function (s) { const t = s.getName().trim(); if (TYPE_TABS.indexOf(t) >= 0 && t !== type) ss.deleteSheet(s); });
  if (email) { try { file.addEditor(email); } catch (e) { return { ok: true, id: file.getId(), name: name, warn: 'Sheet made, but sharing with ' + email + ' failed: ' + e.message }; } }
  return { ok: true, id: file.getId(), name: name };
}
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
  // Combat Options: the cells under the "Combat Options" heading in column G, down to the Untrained Skills heading
  let co = 0; for (let i = 0; i < grid.length; i++) if (String(grid[i][5]).trim().toLowerCase() === 'combat options') { co = i + 1; break; }
  const coCells = co && ut && co < ut - 1 ? [['G', 'G', co + 1, ut - 1]] : [];
  if (tr && ut && inv && b[6] === 'adroitness' && b[9] === 'charm' && String(grid[inv - 1][5]).trim().toLowerCase() === 'notes') {
    // current layout: Inventory (B-D) | Equipped (E) | Notes (G) side by side, as many rows as needed
    return [['F', 'F', 3, 4], ['F', 'F', 7, 7], ['F', 'F', 10, 10], ['C', 'C', 7, 10],
      ['B', 'C', tr + 1, ut - 1], ['E', 'E', tr + 1, ut - 1], ['B', 'C', ut + 1, inv - 1], ['E', 'E', ut + 1, inv - 1],
      ['B', 'E', inv + 1, 300], ['G', 'G', inv + 1, 300]].concat(coCells);
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
  ].concat(coCells);
}
function manageAllowed(list, a1) {
  const m = /^([A-L])(\d+)$/.exec(a1); if (!m) return false;
  const c = m[1], n = Number(m[2]);
  return list.some(function (x) { return c >= x[0] && c <= x[1] && n >= x[2] && n <= x[3]; });
}

// Run this once from the Apps Script editor (pick it in the function dropdown, press Run, then Allow)
// so the bridge may copy the Master and share new character sheets.
function setupPermissions() {
  // makes a real copy of the Master and trashes it, so Google asks for (and confirms) full Drive access
  const copy = DriveApp.getFileById(MASTER_ID).makeCopy('Permission test (safe to delete)', DriveApp.getFolderById(CHARACTER_FOLDER_ID));
  copy.setTrashed(true);
  Logger.log('Drive access OK: copied and removed a test sheet. Now deploy a new version.');
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
    if (p.diag) {
      let copy = 'ok';
      try { DriveApp.getFileById(MASTER_ID).makeCopy('Permission test (safe to delete)', DriveApp.getFolderById(CHARACTER_FOLDER_ID)).setTrashed(true); }
      catch (e) { copy = String(e.message || e); }
      return json({ ok: true, runsAs: Session.getEffectiveUser().getEmail(), copy: copy });
    }
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
    if (b.create) return json(createCharacter(b.create));
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
