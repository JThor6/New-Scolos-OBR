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
// Campaigns: each campaign is a subfolder (same name) inside the character folder and the encounter folder.
// Rooms with no campaign set use the sheets sitting directly in those folders (the main campaign).
function campaignFolder(rootId, name) {
  name = String(name || '').trim();
  if (!name) return DriveApp.getFolderById(rootId);
  const it = DriveApp.getFolderById(rootId).getFoldersByName(name);
  return it.hasNext() ? it.next() : null;
}
function sheetsIn(folder) {
  const out = [];
  if (!folder) return out;
  const it = folder.getFilesByType(MimeType.GOOGLE_SHEETS);
  while (it.hasNext()) { const f = it.next(); out.push({ id: f.getId(), name: f.getName(), t: f.getLastUpdated().getTime() }); }
  return out;
}
const MASTER_ID = '1_cnTDLNHIsaVMAOkOKSKK0YawUHt38ZewW1o5-yWbhU'; // Master New Scolos File for Characters
const TYPE_TABS = ['Priest', 'Mage', 'Mentalist', 'Mercenary', 'Wraith', 'Revenant', 'Hacker', 'Subject Zero'];
const ATTR_COST = { '-3': 0, '-2': 1, '-1': 3, '0': 7, '1': 14, '2': 25, '3': 41 }; // Starting Attribute Calculator, 42 points
const START_LEVELS = [1, 0, 0, 0, -2, -2, -3, -3];                              // Skill List: starting skill levels

// Character Generator: copy the Master into the characters folder and fill it in
function createCharacter(c, campaign) {
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

  const folder = campaignFolder(CHARACTER_FOLDER_ID, campaign);
  if (!folder) throw new Error('No campaign folder named ' + campaign + ' in the characters folder.');
  const file = DriveApp.getFileById(MASTER_ID).makeCopy(name, folder);
  const ss = SpreadsheetApp.openById(file.getId());
  const sh = ss.getSheetByName('Main Sheet');
  const text = function (v) { v = String(v == null ? '' : v); return /^[=@+\-]/.test(v) && isNaN(Number(v)) ? "'" + v : v; };
  sh.getRange('C3').setValue(text(name)); sh.getRange('C4').setValue(type); sh.getRange('C5').setValue(text(c.power || ''));
  A.forEach(function (a, i) { sh.getRange('C' + (7 + i)).setValue(Math.round(Number(c.attrs[a]))); });
  sh.getRange('F3').setValue(xp); sh.getRange('F4').setValue(0); sh.getRange('F6').setValue(false); sh.getRange('F7').setValue(1000 - Math.max(0, Math.min(1000, Math.round(Number(c.spent) || 0)))); sh.getRange('F10').setValue(0);
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
// GM clean-up: move a character sheet (and its PDF export) into the "Stasis" folder in New Scolos Characters.
// Nothing is deleted. The GM empties Stasis by hand in Drive, or drags a sheet back out to restore it.
const STASIS_NAME = 'Stasis';
function moveToStasis(id) {
  id = String(id || '');
  if (!id) throw new Error('Pick a character first.');
  if (id === MASTER_ID) throw new Error('That is the Master file. It stays where it is.');
  const file = DriveApp.getFileById(id);
  // only sheets directly in New Scolos Characters or in one of its campaign folders (not already in Stasis)
  let from = null;
  const ps = file.getParents();
  while (ps.hasNext()) {
    const f = ps.next();
    if (f.getId() === CHARACTER_FOLDER_ID) { from = f; continue; }
    if (f.getName() === STASIS_NAME) continue;
    const up = f.getParents();
    while (up.hasNext()) if (up.next().getId() === CHARACTER_FOLDER_ID) from = f;
  }
  if (!from) throw new Error('That sheet is not in the New Scolos Characters folder (or it is already in Stasis).');
  const root = DriveApp.getFolderById(CHARACTER_FOLDER_ID);
  const it = root.getFoldersByName(STASIS_NAME);
  const stasis = it.hasNext() ? it.next() : root.createFolder(STASIS_NAME);
  let name = '';
  try { name = String(SpreadsheetApp.openById(id).getSheetByName('Main Sheet').getRange('C3').getDisplayValue()).trim(); } catch (e) {}
  try { file.moveTo(stasis); } catch (e) {
    let owner = ''; try { owner = file.getOwner().getEmail(); } catch (x) {}
    throw new Error('Google Drive would not move it' + (owner ? ' (it is owned by ' + owner + ')' : '') + '. Drag it into the Stasis folder by hand in Drive.');
  }
  let pdfs = 0; // the character's exported PDF goes along with it
  if (name) { const old = from.getFilesByName(name + ' - New Scolos Sheet.pdf'); while (old.hasNext()) { try { old.next().moveTo(stasis); pdfs++; } catch (e) {} } }
  return { ok: true, name: name || file.getName(), pdfs: pdfs };
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

// ---------------- PDF EXPORT ----------------
// Fills Jake's fillable template (New_Scolos_Character_Sheet.pdf) from a character's Main Sheet,
// saves it in the character folder (replacing that character's previous export) and returns a link.
const PDF_TEMPLATE_ID = '1nJhcRYr7xSSEk89Oi0ELtabyUgHUMGVF';
// Run once from the editor (function dropdown → authorizePdf → Run → Allow) so the bridge may download pdf-lib.
function authorizePdf() { UrlFetchApp.fetch('https://unpkg.com/pdf-lib@1.17.1/package.json'); Logger.log('PDF export allowed. Now deploy a new version.'); }
// pdf-lib needs setTimeout, which Apps Script doesn't have
var setTimeout = function (f, t) { Utilities.sleep(t || 0); return f(); };

async function exportPdf(id) {
  const sh = openMain(id), ss = sh.getParent();
  const grid = sh.getRange('A1:L300').getDisplayValues();
  const v = function (a1) { const m = /^([A-L])(\d+)$/.exec(a1); return String(((grid[Number(m[2]) - 1] || [])[m[1].charCodeAt(0) - 65]) || '').trim(); };
  const colB = grid.map(function (r) { return String(r[1]).trim().toLowerCase(); });
  const at = function (label, from) { for (let i = from || 0; i < colB.length; i++) if (colB[i] === label) return i + 1; return 0; };
  const tr = at('trained skills') || 19, ut = at('untrained skills', tr) || 37, inv = at('inventory', ut) || 46;
  let co = 0; for (let i = 0; i < ut; i++) if (String((grid[i] || [])[6]).trim().toLowerCase() === 'combat options') { co = i + 1; break; }
  let end = grid.length; while (end > inv && !grid[end - 1].slice(1, 7).join('').trim()) end--;

  eval(UrlFetchApp.fetch('https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js').getContentText());
  const tpl = DriveApp.getFileById(PDF_TEMPLATE_ID).getBlob().getBytes();
  const pdf = await PDFLib.PDFDocument.load(new Uint8Array(tpl));
  const form = pdf.getForm();
  const set = function (f, val) { try { form.getTextField(f).setText(val || ''); } catch (e) {} };
  const check = function (f, on) { try { const c = form.getCheckBox(f); on ? c.check() : c.uncheck(); } catch (e) {} };

  // Top. Priests and Mages: invocations / spell points and their god or schools go on the Extraordinary Power line.
  const type = v('C4'), notes = []; for (let r = inv + 1; r <= end; r++) if (v('G' + r)) notes.push(v('G' + r));
  const note = function (re) { for (let i = 0; i < notes.length; i++) { const m = re.exec(notes[i]); if (m) return m[1].trim(); } return ''; };
  const ptsName = /priest/i.test(type) ? 'Invocations' : /mage/i.test(type) ? 'Spell Points' : (v('E13') && !/\//.test(v('E13')) ? v('E13') : '');
  const ptsMax = /^\d+$/.test(v('H13')) ? v('H13') : /^\d+$/.test(v('G13')) ? v('G13') : '';
  const extra = [];
  if (ptsName && (v('F13') !== '' || ptsMax)) extra.push(ptsName + ' ' + (v('F13') || '0') + (ptsMax ? ' / ' + ptsMax : ''));
  const god = note(/^god:\s*(.+)$/i), major = note(/^major school:\s*(.+)$/i), minor = note(/^minor school:\s*(.+)$/i);
  if (god) extra.push('God: ' + god);
  if (major || minor) extra.push('Major: ' + (major || '-') + ' · Minor: ' + (minor || '-'));
  set('Name', v('C3')); set('Type', type); set('Level', v('F5')); set('Credits', v('F7'));
  set('ExtPower', [v('C5')].concat(extra).filter(String).join('  ·  '));
  check('ExtPowerUsed', v('F6').toUpperCase() === 'TRUE');
  set('CurrentXP', v('F3')); set('SpentXP', v('F4')); set('AttrSpent', v('F10')); set('AttrRemaining', v('F12'));
  set('Adroitness', v('C7')); set('RawStrength', v('C8')); set('Intellect', v('C9')); set('Charm', v('C10')); set('DamagePenalty', v('C12'));
  ['B', 'C', 'D', 'E', 'F', 'G', 'H'].forEach(function (c, i) { const m = v(c + '16'); check('Wound' + (i + 1), m !== '' && m.toUpperCase() !== 'FALSE' && m !== '0'); });

  // Skills: found by their headings, packed into the template's 16 trained / 8 untrained rows
  const skills = function (prefix, from, to, max) { let n = 0; for (let r = from; r <= to && n < max; r++) { if (!v('B' + r)) continue; n++;
    set(prefix + n + '_Skill', v('B' + r)); set(prefix + n + '_Attribute', v('C' + r)); set(prefix + n + '_Rank', v('D' + r)); set(prefix + n + '_Level', v('E' + r)); set(prefix + n + '_Total', v('F' + r)); } };
  skills('Trained', tr + 1, ut - 1, 16); skills('Untrained', ut + 1, inv - 1, 8);

  // Combat, options, gear
  set('MeleeDmg', v('H23')); set('RangedDmg', v('H24')); set('ArmorBonus', v('H25')); set('COPPerCombat', v('H28')); set('COPSpent', v('H29'));
  const opts = []; if (co) for (let r = co + 1; r < ut; r++) if (v('G' + r)) opts.push(v('G' + r));
  set('CombatOptions', opts.join('\n'));
  const invList = [], eq = [];
  for (let r = inv + 1; r <= end; r++) { const t = ['B', 'C', 'D'].map(function (c) { return v(c + r); }).filter(String).join(' - '); if (t) invList.push(t); if (v('E' + r)) eq.push(v('E' + r)); }
  set('Inventory', invList.join('\n')); set('Equipped', eq.join('\n'));

  // Save next to the character sheet, replacing this character's previous export, viewable by anyone with the link
  const name = (v('C3') || 'Character') + ' - New Scolos Sheet.pdf';
  const parents = DriveApp.getFileById(id).getParents(), folder = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
  const old = folder.getFilesByName(name); while (old.hasNext()) old.next().setTrashed(true);
  const file = folder.createFile(Utilities.newBlob(Array.from(await pdf.save()), 'application/pdf', name));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { ok: true, url: file.getUrl(), name: name };
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function openMain(id) {
  const file = DriveApp.getFileById(id);
  const parents = file.getParents();
  let ok = false;
  while (parents.hasNext()) { // directly in a New Scolos folder, or in a campaign subfolder of one
    const f = parents.next();
    if (ALLOWED_FOLDER_IDS.indexOf(f.getId()) >= 0) ok = true;
    const up = f.getParents();
    while (up.hasNext()) if (ALLOWED_FOLDER_IDS.indexOf(up.next().getId()) >= 0) ok = true;
  }
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
    if (p.pdfjob) { // result of an Export to PDF started by POST {exportPdf}
      const r = CacheService.getScriptCache().get('pdf:' + p.pdfjob);
      return ContentService.createTextOutput(r || JSON.stringify({ ok: false, error: 'That export expired. Try again.' })).setMimeType(ContentService.MimeType.JSON);
    }
    if (p.list === 'campaigns') { // campaign subfolders of the character folder
      const out = [], it = DriveApp.getFolderById(CHARACTER_FOLDER_ID).getFolders();
      while (it.hasNext()) { const n = it.next().getName(); if (!/^(archive|stasis)/i.test(n)) out.push(n); }
      out.sort();
      return json({ ok: true, campaigns: out });
    }
    if (p.list === 'encounters') { // every encounter sheet in this campaign's encounter folder, newest edited first
      const out = sheetsIn(campaignFolder(ENCOUNTER_FOLDER_ID, p.campaign));
      out.sort(function (a, b) { return b.t - a.t; });
      return json({ ok: true, sheets: out });
    }
    if (p.list) { // character sheets in this campaign's folder
      const out = sheetsIn(campaignFolder(CHARACTER_FOLDER_ID, p.campaign)).map(function (f) { return { id: f.id, name: f.name }; });
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
    if (b.create) return json(createCharacter(b.create, b.campaign));
    if (b.stasis) return json(moveToStasis(b.id));
    if (b.exportPdf) { // start building in the background (a web app can't wait on it), the add-on then asks ?pdfjob= for the result
      openMain(b.id); // folder check up front
      const job = Utilities.getUuid(), cache = CacheService.getScriptCache();
      cache.put('pdf:' + job, JSON.stringify({ ok: true, pending: true }), 600);
      exportPdf(b.id).then(function (r) { cache.put('pdf:' + job, JSON.stringify(r), 600); },
        function (err) { cache.put('pdf:' + job, JSON.stringify({ ok: false, error: String(err && err.message || err) }), 600); });
      return json({ ok: true, job: job });
    }
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
    if (Array.isArray(b.track)) { // Heal / Undo: the whole vitality track in one write
      if (b.track.length !== 7) throw new Error('Bad vitality track.');
      sh.getRange('B16:H16').setValues([b.track.map(function (on) { return on ? 'X' : ''; })]);
    } else if (b.wound !== undefined) {
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
