/**
 * New Scolos Sheet Bridge - lets the Owlbear add-on read a character's Main Sheet
 * and update three live-play things: vitality track, Extraordinary Power used today, COP spent.
 *
 * Owned and deployed by Jake as a web app ("Execute as: Me", "Who has access: Anyone").
 * Only works on sheets inside the New Scolos character folder, and only with the table code.
 * Also saves character portraits into Jake's private Character Portraits folder (see PORTRAITS below).
 */

const TABLE_CODE = 'CHANGE-ME';                          // pick a code; players type it once in Owlbear
const CHARACTER_FOLDER_ID = '1AGoMytVf6xI8DWzMewiEtZF65M9kie88';
// Folders the bridge may open: characters, plus the GM's encounter sheets
const ENCOUNTER_FOLDER_ID = '1UQ_Zq4skyRzjUcaly95g98C2figf6tQs';
const ALLOWED_FOLDER_IDS = [CHARACTER_FOLDER_ID, ENCOUNTER_FOLDER_ID];
const TRACKER_TAB = 'Extension Tracker';
const CO_SLOTS = 10; // Combat Options boxes on the Main Sheet (G column under the heading)
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
  // 10 boxes under the heading (they run past the Untrained Skills heading row), never into Inventory/Notes
  const coCells = co && inv && co < inv - 1 ? [['G', 'G', co + 1, Math.min(co + CO_SLOTS, inv - 1)]] : [];
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
// Run once from the editor (function dropdown -> authorizePdf -> Run -> Allow) so the bridge may download pdf-lib.
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
  if (major || minor) extra.push('Major: ' + (major || '-') + ' \u00B7 Minor: ' + (minor || '-'));
  set('Name', v('C3')); set('Type', type); set('Level', v('F5')); set('Credits', v('F7'));
  set('ExtPower', [v('C5')].concat(extra).filter(String).join('  \u00B7  '));
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
  const opts = []; if (co) for (let r = co + 1; r <= Math.min(co + CO_SLOTS, inv - 1); r++) if (v('G' + r)) opts.push(v('G' + r));
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

// ---------- Rules Work in Progress: Jake's rules draft (Google Doc), read live for the REFERENCE tab ----------
const RULES_DOC_ID = '1A8ioFtPR16XFjo6pBZ6B8-wZwiVGDWLwGYshLY-SerM'; // New Scolos 2026 Main Rules Draft
// Exports the doc as Markdown through Drive (the permission the script already has; DocumentApp would need a new one).
// The add-on turns the Markdown into headings, little tabs, bullets and tables.
function rulesDoc() {
  const r = UrlFetchApp.fetch('https://docs.google.com/document/d/' + RULES_DOC_ID + '/export?format=md',
    { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw new Error('Could not read the rules draft (error ' + r.getResponseCode() + ').');
  const md = r.getContentText().replace(/^\[image\d+\]:.*$/gm, '').replace(/!\[[^\]]*\]\[image\d+\]/g, ''); // pictures don't come through
  return { ok: true, title: DriveApp.getFileById(RULES_DOC_ID).getName(), md: md };
}

// ---------------- PORTRAITS ----------------
// Each character keeps its own set of pictures (up to PORTRAIT_MAX); one of them is the current portrait.
// The add-on resizes each picture and sends two copies: the full picture (saved as "<Name> - Portrait" in the
// Character Portraits folder, Jake's art source for tokens) and a small one the add-on shows at the table
// (kept in a subfolder). Which pictures belong to which sheet is kept in Script Properties ("pt:<sheet id>"),
// so nothing is written on the character sheet and the folder stays private: the bridge hands the pictures out.
// A picture is known by the Drive id of its full file.
const PORTRAIT_FOLDER_ID = '15BY1xqDO4VCLbG8-vGO8uiobgunsAa9W';
const PORTRAIT_SMALL_FOLDER = 'Small copies (used by the extension)';
const PORTRAIT_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
const PORTRAIT_MAX = 12;
function portraitInfo(id) { // { pics: [{full, small, t, f}], cur: full id, t: when the current portrait last changed, n: pictures ever added }
  const s = PropertiesService.getScriptProperties().getProperty('pt:' + id);
  if (!s) return null;
  const i = JSON.parse(s);
  if (!i.pics) return { pics: [{ full: i.full, small: i.small, t: i.t }], cur: i.full, t: i.t, n: 1 }; // saved before picture sets
  return i;
}
function portraitSaveInfo(id, info) {
  const props = PropertiesService.getScriptProperties();
  if (!info.pics.length) props.deleteProperty('pt:' + id);
  else props.setProperty('pt:' + id, JSON.stringify(info));
}
function curPic(info) { return info.pics.filter(function (p) { return p.full === info.cur; })[0] || info.pics[info.pics.length - 1]; }
function portraitStamp(id) { const i = portraitInfo(id); return i && i.pics.length ? i.t : 0; }
function trashPortraitFiles(pic) {
  [pic.full, pic.small].forEach(function (fid) { try { DriveApp.getFileById(fid).setTrashed(true); } catch (e) {} });
}
function liveFile(fid) { try { const f = DriveApp.getFileById(fid); return f.isTrashed() ? null : f; } catch (e) { return null; } }
// drop pictures someone removed in Drive by hand
function prunePortraits(id, info) {
  const keep = info.pics.filter(function (p) { return liveFile(p.full) && liveFile(p.small); });
  if (keep.length === info.pics.length) return info;
  info.pics = keep;
  if (!keep.some(function (p) { return p.full === info.cur; })) { info.cur = keep.length ? keep[keep.length - 1].full : ''; info.t = Date.now(); }
  portraitSaveInfo(id, info);
  return info;
}
// one picture: the current one, or ?pic=<full id>; small copy unless full
function getPortrait(id, full, fid) {
  let info = portraitInfo(id);
  if (!info || !info.pics.length) return { ok: true, none: true };
  let pic = fid ? info.pics.filter(function (p) { return p.full === fid; })[0] : curPic(info);
  let f = pic && liveFile(full ? pic.full : pic.small);
  if (!f) {
    info = prunePortraits(id, info);
    if (fid || !info.pics.length) return { ok: true, none: true };
    pic = curPic(info); f = liveFile(full ? pic.full : pic.small);
    if (!f) return { ok: true, none: true };
  }
  const b = f.getBlob();
  return { ok: true, t: info.t, pic: pic.full, cur: pic.full === info.cur, frame: pic.f || null, mime: b.getContentType(), name: f.getName(), data: Utilities.base64Encode(b.getBytes()) };
}
// every picture of this character (small copies) for the picker
function getGallery(id) {
  let info = portraitInfo(id);
  if (!info) return { ok: true, cur: '', t: 0, pics: [] };
  info = prunePortraits(id, info);
  const pics = info.pics.map(function (p) {
    const b = DriveApp.getFileById(p.small).getBlob();
    return { id: p.full, t: p.t, f: p.f || null, mime: b.getContentType(), data: Utilities.base64Encode(b.getBytes()) };
  });
  const pog = info.pog && liveFile(info.pog) ? info.pog : '';
  return { ok: true, cur: info.cur, t: info.pics.length ? info.t : 0, max: PORTRAIT_MAX, pics: pics, pog: pog };
}
// add a picture to the character's set and make it the portrait
function savePortrait(id, pic) {
  const sh = openMain(id); // folder check
  const full = pic && pic.full, small = pic && pic.small;
  if (!full || !small || !PORTRAIT_EXT[full.mime] || !PORTRAIT_EXT[small.mime]) throw new Error('That picture type will not work. Use a JPG, PNG, WebP or GIF.');
  const fb = Utilities.base64Decode(String(full.data || '')), sb = Utilities.base64Decode(String(small.data || ''));
  if (!fb.length || fb.length > 10 * 1024 * 1024) throw new Error('That picture is too big (10 MB max).');
  if (!sb.length || sb.length > 400 * 1024) throw new Error('The small copy of the picture did not come through. Try again.');
  const name = (String(sh.getRange('C3').getDisplayValue()).trim() || 'Character').replace(/[\\/:*?"<>|]/g, '').slice(0, 60);
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    let info = portraitInfo(id) || { pics: [], cur: '', t: 0, n: 0 };
    if (info.pics.length >= PORTRAIT_MAX) info = prunePortraits(id, info);
    if (info.pics.length >= PORTRAIT_MAX) throw new Error('This character already has ' + PORTRAIT_MAX + ' pictures. Remove one first.');
    const root = DriveApp.getFolderById(PORTRAIT_FOLDER_ID);
    const it = root.getFoldersByName(PORTRAIT_SMALL_FOLDER);
    const smallFolder = it.hasNext() ? it.next() : root.createFolder(PORTRAIT_SMALL_FOLDER);
    const n = (info.n || info.pics.length) + 1, label = name + ' - Portrait' + (n > 1 ? ' ' + n : '');
    const ff = root.createFile(Utilities.newBlob(fb, full.mime, label + '.' + PORTRAIT_EXT[full.mime]));
    const sf = smallFolder.createFile(Utilities.newBlob(sb, small.mime, label + ' (small).' + PORTRAIT_EXT[small.mime]));
    try { ff.setDescription('Uploaded from the New Scolos Manager for character sheet ' + id); } catch (e) {}
    const t = Date.now();
    info.pics.push({ full: ff.getId(), small: sf.getId(), t: t });
    info.cur = ff.getId(); info.t = t; info.n = n;
    portraitSaveInfo(id, info);
    return { ok: true, t: t, pic: ff.getId() };
  } finally { lock.releaseLock(); }
}
// make one of the character's pictures the portrait
function pickPortrait(id, fid) {
  openMain(id); // folder check
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const info = portraitInfo(id);
    if (!info || !info.pics.some(function (p) { return p.full === fid; })) throw new Error('That picture is gone. Reload and try again.');
    if (info.cur !== fid) { info.cur = fid; info.t = Date.now(); portraitSaveInfo(id, info); }
    return { ok: true, t: info.t };
  } finally { lock.releaseLock(); }
}
// how a picture sits in the round portrait: f = {z: zoom 1-5, x, y: 0-100, which part of the picture shows}
function framePortrait(id, fid, f) {
  openMain(id); // folder check
  const z = Number(f && f.z), x = Number(f && f.x), y = Number(f && f.y);
  if (!(z >= 1 && z <= 5 && x >= 0 && x <= 100 && y >= 0 && y <= 100)) throw new Error('Bad picture framing.');
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const info = portraitInfo(id);
    const pic = info && info.pics.filter(function (p) { return p.full === fid; })[0];
    if (!pic) throw new Error('That picture is gone. Reload and try again.');
    pic.f = { z: Math.round(z * 100) / 100, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
    if (info.cur === fid) info.t = Date.now(); // the portrait everyone sees changed
    portraitSaveInfo(id, info);
    return { ok: true, t: info.t, f: pic.f };
  } finally { lock.releaseLock(); }
}
// POGS: the add-on draws the pog (picture + the table's ring) and sends a PNG. One pog per character, saved as
// "<Name> - Pog.png" in Character Portraits -> Pogs (a new one replaces the old one, which goes to Drive's trash).
// Pog files (only those) are "anyone with the link can view", so Owlbear can load them straight onto the map from
// https://lh3.googleusercontent.com/d/<file id> (tested Nov 24 2026: that address works in Owlbear).
function sharePog(f) { try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {} }
const POG_FOLDER = 'Pogs';
function savePog(id, data) {
  const sh = openMain(id); // folder check
  const bytes = Utilities.base64Decode(String(data || ''));
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new Error('The pog did not come through. Try again.');
  const name = (String(sh.getRange('C3').getDisplayValue()).trim() || 'Character').replace(/[\\/:*?"<>|]/g, '').slice(0, 60);
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const info = portraitInfo(id);
    if (!info || !info.pics.length) throw new Error('Add a portrait first.');
    const root = DriveApp.getFolderById(PORTRAIT_FOLDER_ID);
    const it = root.getFoldersByName(POG_FOLDER);
    const folder = it.hasNext() ? it.next() : root.createFolder(POG_FOLDER);
    const f = folder.createFile(Utilities.newBlob(bytes, 'image/png', name + ' - Pog.png'));
    sharePog(f);
    if (info.pog) { try { DriveApp.getFileById(info.pog).setTrashed(true); } catch (e) {} }
    info.pog = f.getId();
    portraitSaveInfo(id, info);
    return { ok: true, name: f.getName(), pogId: f.getId() };
  } finally { lock.releaseLock(); }
}
function getPog(id) {
  const info = portraitInfo(id), f = info && info.pog && liveFile(info.pog);
  if (!f) return { ok: true, none: true };
  return { ok: true, name: f.getName(), mime: 'image/png', data: Utilities.base64Encode(f.getBlob().getBytes()) };
}
// ---------------- MONSTER ART (GM) ----------------
// One picture per monster NAME (the add-on drops trailing numbers, so "Hive Runner 1" and "Hive Runner 3" share it,
// in every encounter). Saved in Character Portraits -> Monster Art: "<Name> - Art", a small copy, and "<Name> - Pog.png"
// (the add-on draws the red enemy ring). Which files belong to which name: Script Properties "ma:<name key>".
const MONSTER_ART_FOLDER = 'Monster Art';
function monKey(k) {
  k = String(k || '').trim().toLowerCase();
  if (!k || k.length > 60) throw new Error('Bad monster name.');
  return k;
}
function monInfo(k) { const s = PropertiesService.getScriptProperties().getProperty('ma:' + k); return s ? JSON.parse(s) : null; }
function subFolder(parent, name) { const it = parent.getFoldersByName(name); return it.hasNext() ? it.next() : parent.createFolder(name); }
// files still used by any monster name (art can be shared between names)
function monFilesInUse() {
  const all = PropertiesService.getScriptProperties().getProperties(), used = {};
  Object.keys(all).forEach(function (key) { if (key.indexOf('ma:') !== 0) return; try { const i = JSON.parse(all[key]); [i.full, i.small, i.pog].forEach(function (id) { used[id] = 1; }); } catch (e) {} });
  return used;
}
function trashUnused(ids) {
  const used = monFilesInUse();
  ids.forEach(function (id) { if (id && !used[id]) { try { DriveApp.getFileById(id).setTrashed(true); } catch (e) {} } });
}
function monSet(k, info) { PropertiesService.getScriptProperties().setProperty('ma:' + k, JSON.stringify(info)); }
function monOut(info, withData) {
  const o = { t: info.t, name: info.name, pogId: info.shared ? info.pog : '', f: info.f || null };
  if (withData) { const f = liveFile(info.small); if (!f) return null; const b = f.getBlob(); o.mime = b.getContentType(); o.data = Utilities.base64Encode(b.getBytes()); }
  return o;
}
function saveMonArt(a) {
  const k = monKey(a && a.key);
  const label = (String(a.name || k).replace(/[\\/:*?"<>|]/g, '').trim() || 'Monster').slice(0, 60);
  const full = a.full, small = a.small, pog = a.pog;
  if (!full || !small || !pog || !PORTRAIT_EXT[full.mime] || !PORTRAIT_EXT[small.mime] || pog.mime !== 'image/png') throw new Error('That picture type will not work. Use a JPG, PNG, WebP or GIF.');
  const fb = Utilities.base64Decode(String(full.data || '')), sb = Utilities.base64Decode(String(small.data || '')), pb = Utilities.base64Decode(String(pog.data || ''));
  if (!fb.length || fb.length > 10 * 1024 * 1024) throw new Error('That picture is too big (10 MB max).');
  if (!sb.length || sb.length > 400 * 1024 || !pb.length || pb.length > 5 * 1024 * 1024) throw new Error('The picture did not come through. Try again.');
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const root = subFolder(DriveApp.getFolderById(PORTRAIT_FOLDER_ID), MONSTER_ART_FOLDER);
    const ff = root.createFile(Utilities.newBlob(fb, full.mime, label + ' - Art.' + PORTRAIT_EXT[full.mime]));
    const sf = subFolder(root, PORTRAIT_SMALL_FOLDER).createFile(Utilities.newBlob(sb, small.mime, label + ' (small).' + PORTRAIT_EXT[small.mime]));
    const pf = subFolder(root, POG_FOLDER).createFile(Utilities.newBlob(pb, 'image/png', label + ' - Pog.png'));
    sharePog(pf);
    const old = monInfo(k);
    const info = { full: ff.getId(), small: sf.getId(), pog: pf.getId(), t: Date.now(), name: label, shared: true, f: null };
    monSet(k, info);
    if (old) trashUnused([old.full, old.small, old.pog]);
    return { ok: true, t: info.t, name: label, pogId: info.pog };
  } finally { lock.releaseLock(); }
}
// a new pog for one monster name: the art placed differently in the red ring (f = zoom/position)
function saveMonPog(a) {
  const k = monKey(a && a.key), f = a.f || {};
  const z = Number(f.z), x = Number(f.x), y = Number(f.y);
  if (!(z >= 1 && z <= 5 && x >= 0 && x <= 100 && y >= 0 && y <= 100)) throw new Error('Bad pog framing.');
  const pb = Utilities.base64Decode(String(a.data || ''));
  if (!pb.length || pb.length > 5 * 1024 * 1024) throw new Error('The pog did not come through. Try again.');
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const info = monInfo(k);
    if (!info) throw new Error('That monster has no art any more. Reload monsters.');
    const pf = subFolder(subFolder(DriveApp.getFolderById(PORTRAIT_FOLDER_ID), MONSTER_ART_FOLDER), POG_FOLDER).createFile(Utilities.newBlob(pb, 'image/png', info.name + ' - Pog.png'));
    sharePog(pf);
    const old = info.pog;
    info.pog = pf.getId(); info.shared = true; info.t = Date.now();
    info.f = { z: Math.round(z * 100) / 100, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
    monSet(k, info);
    trashUnused([old]);
    return { ok: true, t: info.t, pogId: info.pog, f: info.f };
  } finally { lock.releaseLock(); }
}
// use one monster's art for other names too ("Hive Runner Boss" gets the Hive Runner art)
function copyMonArt(a) {
  const from = monKey(a && a.from), info = monInfo(from);
  if (!info) throw new Error('That monster has no art any more. Reload monsters.');
  const to = (a.to || []).slice(0, 30).map(monKey).filter(function (k) { return k !== from; });
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const old = [];
    to.forEach(function (k) { const o = monInfo(k); if (o) old.push(o.full, o.small, o.pog); monSet(k, info); });
    trashUnused(old);
    return { ok: true, art: monOut(info, false), to: to };
  } finally { lock.releaseLock(); }
}
// small copies for many monsters at once; "have" = the times the add-on already has (unchanged ones are skipped)
function getMonArt(keys, have) {
  keys = String(keys || '').split('|').slice(0, 40); have = String(have || '').split('|');
  const out = {};
  keys.forEach(function (raw, i) {
    let k; try { k = monKey(raw); } catch (e) { return; }
    let info = monInfo(k);
    if (!info) { out[k] = null; return; }
    if (!info.shared) { const pf = liveFile(info.pog); if (pf) { sharePog(pf); info.shared = true; monSet(k, info); } } // art made before pogs were shared
    if (String(info.t) === have[i]) { const o = monOut(info, false); o.same = true; out[k] = o; return; }
    const o = monOut(info, true);
    if (!o) { PropertiesService.getScriptProperties().deleteProperty('ma:' + k); out[k] = null; return; }
    out[k] = o;
  });
  return { ok: true, art: out };
}
function getMonFull(k) {
  const info = monInfo(monKey(k)), f = info && liveFile(info.full);
  if (!f) return { ok: true, none: true };
  const b = f.getBlob();
  return { ok: true, mime: b.getContentType(), data: Utilities.base64Encode(b.getBytes()) };
}
function getMonPog(k) {
  const info = monInfo(monKey(k)), f = info && liveFile(info.pog);
  if (!f) return { ok: true, none: true };
  return { ok: true, t: info.t, name: info.name, mime: 'image/png', data: Utilities.base64Encode(f.getBlob().getBytes()) };
}
function removeMonArt(k) {
  k = monKey(k);
  const info = monInfo(k);
  if (info) { PropertiesService.getScriptProperties().deleteProperty('ma:' + k); trashUnused([info.full, info.small, info.pog]); }
  return { ok: true };
}

// remove one picture (Drive trash, restorable for 30 days). If it was the portrait, the newest one left takes over.
function removePortrait(id, fid) {
  openMain(id); // folder check
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const info = portraitInfo(id);
    if (!info) return { ok: true, t: 0 };
    const pic = typeof fid === 'string' ? info.pics.filter(function (p) { return p.full === fid; })[0] : curPic(info);
    if (!pic) return { ok: true, t: portraitStamp(id) };
    trashPortraitFiles(pic);
    info.pics = info.pics.filter(function (p) { return p !== pic; });
    if (info.cur === pic.full) { info.cur = info.pics.length ? info.pics[info.pics.length - 1].full : ''; info.t = Date.now(); }
    portraitSaveInfo(id, info);
    return { ok: true, t: info.pics.length ? info.t : 0 };
  } finally { lock.releaseLock(); }
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
// GET ?code=...&portrait=SHEET_ID  -> that character's small portrait (&full=1 for the full picture, &pic=FILE_ID for another of their pictures)
// GET ?code=...&portraits=SHEET_ID -> all that character's pictures (small copies), for picking a new portrait
// GET ?code=...&pog=SHEET_ID       -> that character's pog (PNG)
// GET ?code=...&monart=k1|k2&have=t1|t2 -> monster art (small copies) by monster name; &monpog=key -> that monster's pog;
//     &monfull=key -> the full art (for re-making the pog)
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
    if (p.doc === 'rules') return json(rulesDoc()); // REFERENCE -> New Scolos Rules Work in Progress
    if (p.portrait) return json(getPortrait(p.portrait, !!p.full, p.pic || ''));
    if (p.portraits) return json(getGallery(p.portraits));
    if (p.pog) return json(getPog(p.pog));
    if (p.monart) return json(getMonArt(p.monart, p.have));
    if (p.monpog) return json(getMonPog(p.monpog));
    if (p.monfull) return json(getMonFull(p.monfull));
    if (p.tab) { // a whole tab, e.g. Combat Options or Priest (used by the Rules tab)
      openMain(p.id); // folder check
      const t = SpreadsheetApp.openById(p.id).getSheetByName(p.tab);
      if (!t) throw new Error('No tab named ' + p.tab);
      const last = Math.min(t.getLastRow(), 200), cols = Math.min(t.getLastColumn(), 20);
      return json({ ok: true, values: last ? t.getRange(1, 1, last, cols).getDisplayValues() : [] });
    }
    const sh = openMain(p.id);
    return json({ ok: true, values: sh.getRange('A1:L300').getDisplayValues(), portrait: portraitStamp(p.id) });
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
    if (b.portrait) return json(savePortrait(b.id, b.portrait));
    if (b.pog) return json(savePog(b.id, b.pog));
    if (b.monArt) return json(saveMonArt(b.monArt));
    if (b.monArtRemove) return json(removeMonArt(b.monArtRemove));
    if (b.monPog) return json(saveMonPog(b.monPog));
    if (b.monArtCopy) return json(copyMonArt(b.monArtCopy));
    if (b.portraitPick) return json(pickPortrait(b.id, String(b.portraitPick)));
    if (b.portraitFrame) return json(framePortrait(b.id, String(b.portraitFrame), b.frame));
    if (b.portraitRemove) return json(removePortrait(b.id, b.portraitRemove));
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
    // send back the new Damage Penalty (a formula on C12) so the add-on shows it without a second read
    SpreadsheetApp.flush();
    return json({ ok: true, dp: sh.getRange('C12').getDisplayValue() });
  } catch (err) {
    return json({ ok: false, error: String(err.message || err) });
  }
}
