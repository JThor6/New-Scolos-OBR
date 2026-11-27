// Fight simulator (Jake, Nov 26): the party against an encounter's monsters, many times over, to rate how hard it is.
// Pure: dice come from a seeded random function, so the same seed gives the same fights (and tests can check them).
//
// What it plays: initiative (Adroitness), each side's best weapon attack vs the target's Adroitness, Success Delta +
// Damage Bonus - Armor Bonus -> wound -> Vitality Track (boxes move right when full), the -1 wound penalty (Critical or
// Down & KO'ed; never for mooks), Down & KO'ed and Dead take you out of the fight. Mooks start with Medium, Critical and
// KO'd pre-marked. A monster whose Special says "any hit kills" dies to any hit that gets through.
// Not played (yet): Combat Options, Extraordinary Powers, spells, Smite, healing, movement, range, cover, monster specials.
import { woundFor } from "../shared.js";
import { num, pCell } from "./util.js";
import { pickWoundBox, isMook } from "./wounds.js";
import { W_MEL } from "./combat.js";
import { partySkills } from "./sheet.js";

// ---- dice
export function seeded(seed = 1) { // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const dF = (rng) => Math.floor(rng() * 3) - 1;
export const roll4 = (rng) => dF(rng) + dF(rng) + dF(rng) + dF(rng);

// ---- fighters
// A character sheet's values -> a hero. Attack: the best attack skill on the sheet (Ranged / Melee Damage Bonus by its
// kind); none = Melee Weapon Fighting untrained (Adroitness - 4).
// opt.current: start with the wounds marked on the sheet now (default: fresh, no wounds)
export function heroFromSheet(v, opt = {}) {
  const name = pCell(v, "C3") || "Hero";
  const adr = num(pCell(v, "C7")) ?? 0, mdb = num(pCell(v, "H23")) ?? 0, rdb = num(pCell(v, "H24")) ?? 0, ab = num(pCell(v, "H25")) ?? 0;
  const atks = partySkills(v).filter(s => s.atk).map(s => ({ name: s.n, mod: s.t, db: W_MEL.test(s.n) ? mdb : rdb }));
  if (!atks.length) atks.push({ name: "Melee Weapon Fighting (untrained)", mod: adr - 4, db: mdb });
  const best = atks.sort((a, b) => (b.mod + b.db) - (a.mod + a.db))[0];
  const track = "BCDEFGH".split("").map(c => !!opt.current && !!pCell(v, c + "16"));
  return { side: "party", name, type: pCell(v, "C4"), adr, ab, atk: best, track, mook: false };
}
// The encounter's Extension Tracker rows -> monsters (row 3 is the header: Name, Group, Kind, Raw Str, Adroitness,
// Intellect, Charm, Attack, Offense, Defense, Armor, Special, 7 wound boxes, Dead). Dead ones are left out.
export function monstersFromTracker(values) {
  const v = values || [], c = (r, i) => String(r?.[i] ?? "").trim(), out = [], warn = [];
  const hdr = Math.max(0, v.findIndex(r => c(r, 0).toLowerCase() === "name"));
  for (const r of v.slice(hdr + 1)) {
    const name = c(r, 0); if (!name || /^(true|x|yes|dead)$/i.test(c(r, 19))) continue;
    const mook = isMook(r);
    const m = c(r, 7).match(/([+\-−]?\d+)\s*$/), mod = m ? num(m[1]) : null;
    const db = num(c(r, 8)), ab = num(c(r, 10));
    if (mod == null) warn.push(`${name}: no Attack number, it can't attack`);
    if (mod != null && db == null) warn.push(`${name}: Offense "${c(r, 8) || "-"}" isn't a number, counted as +0`);
    const track = [12, 13, 14, 15, 16, 17, 18].map(i => !!c(r, i));
    if (mook && !track.some(Boolean)) { track[3] = track[4] = track[5] = true; } // pre-marked like the GM tab does
    out.push({ side: "foes", name, group: c(r, 1) || name, adr: num(c(r, 4)) ?? 0, ab: ab ?? 0, mook,
      atk: mod == null ? null : { name: c(r, 7), mod, db: db ?? 0 }, track, oneHit: /any hit kills/i.test(c(r, 11)) });
  }
  return { monsters: out, warn };
}

// ---- state
export const isDead = (f) => f.track[6];
export const isOut = (f) => isDead(f) || (!f.mook && f.track[5]);
export const penOf = (f) => !f.mook && (f.track[4] || f.track[5]) ? -1 : 0;
// One hit landing: the box it marks (or Dead outright for "any hit kills"). Returns the box, -1 if already dead.
export function takeWound(f, w) {
  if (w <= 0) return null;
  if (f.oneHit) { f.track[6] = true; return 6; }
  const i = pickWoundBox(f.track, w); if (i >= 0) f.track[i] = true;
  return i;
}
// One attack: rolls both sides, applies the wound. Returns what happened.
export function attack(a, d, rng) {
  const at = roll4(rng) + a.atk.mod + penOf(a), dt = roll4(rng) + d.adr + penOf(d), delta = at - dt;
  if (delta < 0) return { hit: false, delta };
  const dmg = delta + a.atk.db - d.ab, w = woundFor(dmg), box = takeWound(d, w);
  return { hit: true, delta, dmg, w, box };
}

// Open boxes left before this one is out of the fight (1 for "any hit kills")
export const toDown = (f) => f.oneHit ? 1 : f.track.slice(0, f.mook ? 7 : 6).filter(x => !x).length;
// How dangerous its attack is
export const threat = (f) => f.atk ? f.atk.mod + f.atk.db : -99;
export function chooseTarget(list, how, rng) {
  if (!list.length) return null;
  if (how === "focus") return [...list].sort((a, b) => toDown(a) - toDown(b) || a.name.localeCompare(b.name))[0];
  if (how === "boss") return [...list].sort((a, b) => threat(b) - threat(a) || toDown(a) - toDown(b) || a.name.localeCompare(b.name))[0];
  return list[Math.floor(rng() * list.length)];
}
// ---- one fight
// tactics for each side: "focus" (finish whoever is closest to going down), "boss" (the most dangerous attacker first),
// or "random".
export function fight(party, foes, rng, opt = {}) {
  const maxRounds = opt.maxRounds || 20, tp = opt.party || "focus", tf = opt.foes || "random";
  const all = [...party, ...foes].map(f => ({ ...f, track: [...f.track], init: roll4(rng) + f.adr, tie: rng() }));
  all.sort((a, b) => (b.init - a.init) || (b.adr - a.adr) || ((b.side === "party") - (a.side === "party")) || (a.tie - b.tie));
  const pick = (list, how) => chooseTarget(list, how, rng);
  let round = 0;
  const left = (side) => all.filter(f => f.side === side && !isOut(f));
  while (round < maxRounds && left("party").length && left("foes").length) {
    round++;
    for (const f of all) {
      if (isOut(f) || !f.atk) continue;
      const enemies = left(f.side === "party" ? "foes" : "party"); if (!enemies.length) break;
      attack(f, pick(enemies, f.side === "party" ? tp : tf), rng);
    }
  }
  const win = !left("foes").length && left("party").length ? "party" : !left("party").length ? "foes" : "draw";
  return { win, rounds: round, party: all.filter(f => f.side === "party").map(f => ({ name: f.name, track: f.track })),
    foesDown: all.filter(f => f.side === "foes" && isOut(f)).length };
}

// ---- many fights -> difficulty
export function simulate(party, foes, opt = {}) {
  const runs = opt.runs || 100, rng = seeded(opt.seed ?? 1);
  const per = Object.fromEntries(party.map(h => [h.name, { ko: 0, dead: 0, hurt: 0 }]));
  let won = 0, lost = 0, draw = 0, rounds = 0, anyDown = 0, anyDead = 0, foesDown = 0;
  for (let i = 0; i < runs; i++) {
    const r = fight(party, foes, rng, opt);
    if (r.win === "party") won++; else if (r.win === "foes") lost++; else draw++;
    rounds += r.rounds; foesDown += r.foesDown;
    let down = false, dead = false;
    for (const h of r.party) { const p = per[h.name];
      if (h.track[6]) { p.dead++; dead = true; } else if (h.track[5]) { p.ko++; down = true; } else if (h.track.some(Boolean)) p.hurt++; }
    if (down || dead) anyDown++; if (dead) anyDead++;
  }
  const pct = (n) => Math.round(100 * n / runs);
  const res = { runs, win: pct(won), loss: pct(lost), draw: pct(draw), rounds: +(rounds / runs).toFixed(1), anyDown: pct(anyDown), anyDead: pct(anyDead),
    foesDown: +(foesDown / runs).toFixed(1), foes: foes.length,
    heroes: party.map(h => ({ name: h.name, dead: pct(per[h.name].dead), ko: pct(per[h.name].ko), hurt: pct(per[h.name].hurt) })) };
  res.rating = rate(res);
  return res;
}
// Easy: they win and almost nobody drops. Medium: they win, someone sometimes drops. Hard: real chance of losing or
// someone often goes down. Deadly: they lose often, or a hero dies in 1 fight out of 5 or more.
export function rate(r) {
  if (r.win < 50 || r.anyDead >= 20) return "Deadly";
  if (r.win < 85 || r.anyDown >= 50 || r.anyDead >= 8) return "Hard";
  if (r.win < 97 || r.anyDown >= 15 || r.anyDead >= 2) return "Medium";
  return "Easy";
}
