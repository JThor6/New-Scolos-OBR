// Moving the initiative turn (NEXT TURN, END TURN, START TURNS, picking a name on the bar). Pure.
import { INIT, initEntries, initMove, turnNames } from "../shared.js";

// Everything that says whose turn it is, as one string: two screens that show the same key show the same turn
export const turnKey = (st) => st?.open ? `${st.sid}|${st.round || 1}|${st.cur || ""}|${st.sub || 0}` : "";

// One step forward (d = 1) or back (d = -1), skipping dead monsters (isDead(name)).
// seenKey: the turn the button was showing when it was tapped. If the turn has moved since, nothing happens.
export function stepTurn(md, d, seenKey, isDead = () => false) {
  const st = md?.[INIT]; if (!st?.open) return null;
  if (seenKey !== undefined && seenKey !== null && seenKey !== turnKey(st)) return null; // a late or double tap: leave the turn alone
  let x = md, nx = null;
  for (let k = 0; k < 60; k++) { nx = initMove(x, d); if (!nx) break; x = { ...x, [INIT]: nx }; if (!isDead(turnNames(x).cur)) break; }
  return nx;
}
// The GM picks a name on the initiative bar
export function pickTurn(md, id) { const st = md?.[INIT]; return st ? { ...st, cur: id, sub: 0, auto: 0 } : null; }
// A fight starts on the first person's turn by itself. Until someone moves the turn, it follows whoever is on top.
export function autoFirstTurn(md) {
  const st = md?.[INIT]; if (!st?.open || (st.cur && !st.auto)) return null;
  const list = initEntries(md); if (!list.length) return null;
  const top = list[0].id; if (st.cur === top && !(st.sub || 0)) return null;
  return { ...st, cur: top, sub: 0, round: st.round || 1, auto: 1 };
}
