// Combat: Combat Options, which skills are attacks, monster attack text, who can defend. Pure.
import { sameName } from "../shared.js";
import { nm } from "./util.js";
export const CO = {
  "acid touch": { s: "Auto hit by touch. For 3 rounds the target takes 1 extra wound each round (lightest box open).", fx: { end: "rounds", n: 3, foe: 1, t: "ACID TOUCH", x: "1 extra wound each round (lightest box open)" } },
  "attack twice": { roll: "atk", two: -1, s: "Two attacks. The second needs a second weapon and gets -1." },
  "auto flank": { roll: "atk", x: 1, s: "Slips into a flanking spot and attacks with +1." },
  "charge": { roll: "melee", x: 1, s: "Double move in a straight line, then a melee attack at +1." },
  "create optical illusion double": { s: "Until their next turn, each attack on them has a 50/50 chance to hit the double.", fx: { end: "turn", t: "OPTICAL DOUBLE", x: "Each attack on them flips a coin by itself. Tails: it hits the double and misses.", coin: 1 } },
  "defend a friend": { s: "They and chosen allies within 10 ft get +1 Adroitness until their next turn.", fx: { end: "turn", ally: "many", self: 1, on: "adroit", v: 1, t: "DEFEND A FRIEND", x: "+1 on Adroitness rolls" } },
  "destroy armor": { s: "Auto hit, no damage. The target's Armor Bonus is -1 for the rest of the combat.", fx: { end: "combat", foe: 1, arm: -1, t: "ARMOR DESTROYED", x: "Armor Bonus -1 for the rest of the combat (counted in Success Delta)" } },
  "encourage": { s: "One player gets +1 on all their rolls until the encourager's next turn.", fx: { end: "turn", ally: "one", self: 1, on: "all", v: 1, t: "ENCOURAGED", x: "+1 on all rolls" } },
  "exchange places": { s: "Swaps places with an ally. Uses their movement, not their attack." },
  "exploding hit": { roll: "atk", s: "If it hits, the damage also lands on chosen targets within 5 ft, at -1." },
  "hide in place": { s: "Builds a cocoon out of nothing and hides in it." },
  "mark enemy": { s: "Everyone gets +1 against the marked enemy until the marker's next turn.", fx: { end: "turn", foe: 1, vs: 1, v: 1, t: "MARKED", x: "Everyone gets +1 against it" } },
  "power grab": { s: "Wraps up an enemy and holds them in place. Neither of them can move.", fx: { end: "rounds", grab: 1, foe: 1, t: "POWER GRAB", x: "Held in place (neither can move)" } },
  "power strike": { roll: "atk", s: "On a hit, the target flies back 10 ft. Into a wall: +1 Light Wound." },
  "retaliate": { roll: "atk", s: "Hit by an enemy's attack, they strike back right away." },
  "shadow to shadow move": { s: "Steps from one shadow to another in the room, then keeps moving." },
  "shield ally": { s: "Takes an attack meant for an ally instead." },
  "stop": { s: "The target can't move until the end of its next turn.", fx: { end: "turn", foe: 1, t: "STOPPED", x: "Movement 0 until the end of its next turn" } },
  "super jump": { s: "Jumps as if flying until their next turn. Uses their movement, not their attack.", fx: { end: "turn", t: "SUPER JUMP", x: "Flying-jump until their next turn" } },
  "weaken": { pick: [
    { u: "Weaken: -2 on its next damage", s: "The target's next damage gets -2.", fx: { end: "combat", foe: 1, dmg: -2, t: "WEAKENED", x: "-2 on its next damage" } },
    { u: "Weaken: -1 on its attacks until my next turn", s: "The target's attacks get -1 until the weakener's next turn.", fx: { end: "turn", foe: 1, on: "atk", v: -1, t: "WEAKENED", x: "-1 on its attacks" } }] },
};
export const coKey = (n) => String(n || "").replace(/\([^)]*\)/g, "").trim().toLowerCase();
export const coDef = (n) => CO[coKey(n)] || null;
// COP left from max (H28) and spent (H29); null when max isn't a number
export const copLeftOf = (max, spent) => { const m = parseInt(max); return isNaN(m) ? null : Math.max(0, m - (parseInt(spent) || 0)); };
// Manage Character: options known = COP points, on a slow ladder: level 1: 1, level 4: 2, level 10: 3, level 20: 4
export const copLadder = (lvl) => lvl >= 20 ? 4 : lvl >= 10 ? 3 : lvl >= 4 ? 2 : lvl >= 1 ? 1 : 0;
// Skill names that count as attacks (Kill Shot, attack Combat Options), melee and ranged
export const W_MEL = /melee|martial|\b(sword|knife|knives|blade|axe|club|spear|hammer|staff|brawl|boxing|kung fu|cqc|unarmed)/i;
export const W_RNG = /ranged|unconventional|\b(rifle|pistol|gun|blaster|laser|bow|shotgun|sniper|grenade|thrown)/i;
export const KS_ATTACK = /ranged weapon|melee weapon|martial art|unconventional weapon|\b(sword|knife|knives|blade|axe|club|spear|hammer|brawl|boxing|kung fu|cqc|unarmed|rifle|pistol|gun|blaster|laser|bow|shotgun|sniper|grenade|thrown)/i;
// A daily power's kind when its type tab doesn't say: these are combat, the rest utility
export const kindOfName = (name, kinds = {}) => kinds[String(name || "").toLowerCase().trim()] || (/^(kill shot|death mark|flash forward|corpse walk|meltdown|bullet stop|hijack|avatar|commune)$/i.test(String(name || "").trim()) ? "combat" : "utility");
// An encounter card's Attack and Offense cells ("Claw +2; Bite +1") -> [{ name, val, off }]
export function monAttacks(atk, off) {
  const split = (t) => String(t || "").split(/\s*(?:\n|;|\s\/\s)\s*/).map(x => x.trim()).filter(Boolean);
  const offs = split(off), parts = split(atk).filter(p => p !== "-"); if (!parts.length) return [{ name: "", val: "", off: String(off || "") }];
  return parts.map((p, i) => { const m = p.match(/^(.*?)[\s:]*([+\-−]?\d+)$/);
    return { name: m ? m[1].replace(/[:\s]+$/, "").trim() : p, val: m ? m[2] : "", off: offs.length > 1 ? (offs[i] ?? offs[0]) : String(off || "") }; });
}
// A waiting attack: which attribute defends (spells can name another), and whether this name may still roll defense
export const defAttr = (w) => w?.dfa || "Adroitness";
export function canDefend(w, name) { if (!name || sameName(name, w.att) || (w.defs || []).some(d => sameName(d, name))) return false;
  return !w.tg?.length || w.tg.some(t => sameName(t, name)); }

// Which row of the encounter's Extension Tracker is this name? Exact name first; otherwise a loose match ("Hive Runner 1"
// against a row "Hive Runner"), but only when exactly one row matches. -1: not on the tracker. (Nov 27 fix)
export function monRowOf(v, name) {
  const rows = v || [], key = nm(name); if (!key) return -1;
  const hdr = Math.max(0, rows.findIndex(r => String(r?.[0] || "").trim().toLowerCase() === "name"));
  const ex = rows.findIndex((r, i) => i > hdr && nm(r?.[0]) === key); if (ex > 0) return ex;
  const loose = rows.map((r, i) => (i > hdr && sameName(r?.[0], name) ? i : -1)).filter(i => i > 0);
  return loose.length === 1 ? loose[0] : -1;
}
