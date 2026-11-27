// Fight simulator from the command line: node sim/run.js <fight.json> [runs] [seed]
// fight.json: { "party": [<character sheet values>, ...], "tracker": <Extension Tracker values>, "runs": 100,
//              "partyTactics": "focus" | "boss" | "random", "foeTactics": "random" | "focus" | "boss", "maxRounds": 20,
//              "currentWounds": false (true: heroes start with the wounds on their sheets now) }
// (sheet values = rows of cells, exactly what the Sheet Bridge or the Sheets API gives for the sheet)
import { readFileSync } from "node:fs";
import { heroFromSheet, monstersFromTracker, simulate } from "../logic/sim.js";

const [file, runsArg, seedArg] = process.argv.slice(2);
if (!file) { console.log("usage: node sim/run.js <fight.json> [runs] [seed]"); process.exit(1); }
const f = JSON.parse(readFileSync(file, "utf8"));
const party = f.party.map(v => Array.isArray(v) ? heroFromSheet(v, { current: f.currentWounds }) : v);
const { monsters, warn } = monstersFromTracker(f.tracker);
const foes = [...monsters, ...(f.extraFoes || [])];
const r = simulate(party, foes, { runs: +runsArg || f.runs || 100, seed: +seedArg || f.seed || 1, party: f.partyTactics, foes: f.foeTactics, maxRounds: f.maxRounds });
const sg = (n) => (n > 0 ? "+" : "") + n;
console.log(`PARTY`); for (const h of party) console.log(`  ${h.name}: ${h.atk.name} ${sg(h.atk.mod)} (Damage ${sg(h.atk.db)}), Adroitness ${sg(h.adr)}, Armor ${sg(h.ab)}`);
console.log(`FOES`); for (const m of foes) console.log(`  ${m.name}${m.mook ? " (mook)" : ""}: ${m.atk ? `attack ${sg(m.atk.mod)} (Damage ${sg(m.atk.db)})` : "no attack"}, Adroitness ${sg(m.adr)}, Armor ${sg(m.ab)}${m.oneHit ? ", any hit kills" : ""}`);
if (warn.length) { console.log("NOTES"); for (const w of warn) console.log("  " + w); }
console.log(`\nRATING: ${r.rating.toUpperCase()}  (${r.runs} fights)`);
console.log(`  Party wins ${r.win}%, loses ${r.loss}%, still going after ${f.maxRounds || 20} rounds ${r.draw}%`);
console.log(`  Average fight: ${r.rounds} rounds, ${r.foesDown} of ${r.foes} foes down`);
console.log(`  A hero goes down (KO'd or dead) in ${r.anyDown}% of fights; a hero dies in ${r.anyDead}%`);
for (const h of r.heroes) console.log(`  ${h.name}: dead ${h.dead}%, KO'd ${h.ko}%, hurt ${h.hurt}%`);
console.log(JSON.stringify(r));
