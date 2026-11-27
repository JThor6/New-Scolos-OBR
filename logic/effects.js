// The shared effects list (Combat Options and spells that last): when an effect is still on, and what it does to a roll.
// Pure: fxPlan changes the roll object it's given and returns the list changes for the page to write to the room.
import { INIT, sameName, turnNames } from "../shared.js";
import { W_MEL } from "./combat.js";

export function fxAlive(e, md, now = Date.now()) {
  if (!e || now - (e.ts || 0) > 8 * 3600e3) return false;
  const st = md?.[INIT];
  if (e.sid) {
    if (!st?.open || st.sid !== e.sid) return false;
    const cur = turnNames(md).cur, moved = (st.round || 1) !== e.r0 || st.cur !== e.c0;
    if (e.end === "turn" && moved && cur && sameName(cur, e.by)) return false;
    if (e.end === "rounds" && (st.round || 1) - e.r0 >= e.n && cur && sameName(cur, e.by)) return false;
  }
  return true;
}
export const fxMine = (e, who) => (e.to || []).some(t => sameName(t, who));

// Bonuses from the list, added to a roll r as it's made.
// ctx: { me: my character's name (rolls from the sheet), whoName: a monster's name (GM rolls), wait: the attack
// waiting for defense or null, tails: () => true/false coin flip }.
// Returns actions: { a: "use", id, who } (that one's use of a "once" effect is spent), { a: "end", id },
// { a: "copies", id, left } (Mirror Images lost a copy).
export function fxPlan(list, r, ctx) {
  const acts = [];
  if (!list.length) return acts;
  const add = (v, t) => { r.mod += v; r.total += v; r.label = `${r.label} · ${t} ${v > 0 ? "+" : ""}${v}`.slice(0, 80); };
  // Jake, Nov 26: the same option never adds up (two Encourages on Raxx = +1, not +2)
  const seen = new Set(), once = (e) => { const k = e.o + "|" + (e.on || e.vs || e.arm || e.dmg); if (seen.has(k)) return false; seen.add(k); return true; };
  // out of a fight, a bonus that would last "until your next turn" is used up by its first roll (Jake, Nov 26);
  // "once" spells (Numb, Heat Shimmer) are gone after one use
  const used = (e, who) => { if (!e.once && (e.sid || e.end !== "turn")) return; acts.push({ a: "use", id: e.id, who }); };
  const defense = /^adroitness/i.test(r.label) && !/initiative/i.test(r.label);
  if (!ctx.whoName) { const me2 = ctx.me; if (!me2) return acts;
    for (const e of list) {
      if (e.on === "adroit" && fxMine(e, me2) && defense && once(e)) { add(e.v, e.o); used(e, me2); }
      if (e.on === "all" && fxMine(e, me2) && once(e)) { add(e.v, e.o); used(e, me2); }
      if (e.vs && r.atk && (r.tg || []).some(n => fxMine(e, n)) && once(e)) { add(e.v, "Marked"); if (!e.sid) acts.push({ a: "end", id: e.id }); }
      // spells (Nov 26): armor, damage, Sneak, and Stone Skin / Deflect stopping a hit
      if (e.on === "armor" && fxMine(e, me2) && r.ab != null && once(e)) r.ab += e.v;
      if (e.on === "dmg" && fxMine(e, me2) && r.atk && r.db != null && once(e)) { r.db += e.v; r.label = `${r.label} · ${e.o} +${e.v} damage`.slice(0, 80); }
      if (e.on === "sneak" && fxMine(e, me2) && /^sneak/i.test(r.label) && once(e)) add(e.v, e.o);
      if (e.nohit && fxMine(e, me2) && defense && once(e)) { const w = ctx.wait;
        if (w && (!e.ranged || !W_MEL.test(w.l || "")) && (w.at ?? 0) >= r.total) { r.blk = e.o; r.label = `${r.label} · ${e.o}: no damage!`.slice(0, 80); used(e, me2); } }
      // Optical Illusion Double: defending while an attack waits flips the coin by itself; tails = the attack hits the double
      if (e.coin && sameName(e.by, me2) && defense && ctx.wait && once(e)) {
        const tails = !!ctx.tails();
        if (tails) r.dbl = 1; r.label = `${r.label} · ${e.uses ? "Copy" : "Double"}: ${tails ? "tails, it hits the " + (e.uses ? "copy!" : "double!") : "heads, the real one"}`.slice(0, 80);
        if (tails && e.uses) acts.push({ a: "copies", id: e.id, left: e.uses - 1 }); }
    }
  } else {
    const whoName = ctx.whoName;
    for (const e of list) {
      if (!fxMine(e, whoName)) continue;
      if (r.atk && e.on === "atk" && once(e)) { add(e.v, e.o); used(e, whoName); }
      if (e.on === "all" && once(e)) add(e.v, e.o); // Drain / Weaken spells on a monster
      if (r.atk && e.dmg && r.db != null && once(e)) { r.db += e.dmg; r.label = `${r.label} · ${e.o} ${e.dmg} damage`.slice(0, 80); acts.push({ a: "end", id: e.id }); }
      if (e.arm && r.ab != null && once(e)) r.ab = Math.max(0, r.ab + e.arm); // Destroy Armor / Break Armor: counts when this monster defends
    }
  }
  return acts;
}
// One action applied to the list (the page writes the result back to the room)
export function fxAct(l, act) {
  if (act.a === "end") return l.filter(a => a.id !== act.id);
  if (act.a === "use") { const e = l.find(a => a.id === act.id); if (!e) return l;
    const left = (e.to || []).filter(t => !sameName(t, act.who));
    return left.length ? l.map(a => a.id === act.id ? { ...a, to: left } : a) : l.filter(a => a.id !== act.id); }
  if (act.a === "copies") { const left = act.left;
    return left > 0 ? l.map(a => a.id === act.id ? { ...a, uses: left, x: `${left} cop${left === 1 ? "y" : "ies"} left: each attack has a 1 in 2 chance of popping one` } : a) : l.filter(a => a.id !== act.id); }
  return l;
}
