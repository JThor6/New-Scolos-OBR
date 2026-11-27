# New Scolos Manager (Owlbear Rodeo extension)

Static site on GitHub Pages: plain HTML + ES modules, no build step. `index.html` is the main panel, the GM screen and the
Party pop-out; the other `.html` files are Owlbear pop-ups and the background page.

## Code layout
- `logic/*.js`: pure game logic. No page (`document`, `$`), no Owlbear (`OBR`), no storage, no clock unless passed in.
  - `util.js`: `num`, `sgn`, `nm`, `tc`, `pCell`
  - `wounds.js`: Vitality Track boxes, which box a wound marks, healing, mook / dead monster rows
  - `spells.js`: spell sizes, cast odds, reading spell text, spells that do something by themselves
  - `combat.js`: Combat Options, attack skills, monster attack text, who can defend
  - `effects.js`: the shared effects list: is an effect still on, and what it does to a roll (`fxPlan`, `fxAct`)
  - `sheet.js`: reading a character sheet's values (skills, New Day, COP, points)
  - `chargen.js`: Character Creator rules
- `shared.js`, `rules.js`: shared by several pages (roll storage, Success Delta, initiative order, rules text).
- Pages import from these. Put new rules math in `logic/` as a plain function and call it from the page.

## Tests
- `npm test` (Node's built-in runner, nothing to install). Tests live in `test/*.test.js`.
- New logic in `logic/` gets tests in the same change.
- **Bug fixes: red, then green.** Write a test that shows the bug and run it: it must fail (red). Then fix, and run the
  whole suite: everything passes (green). Report both runs. If the bug lives in page / Owlbear code that can't be tested,
  first move the deciding logic into `logic/` so it can be, or say plainly why not.

## Other checks before pushing
- ESLint (`no-undef`, `no-redeclare`) over every page's module script.
- Playwright screenshots in standalone mode for anything visible.
- Real-room behavior (initiative, Success Delta, pop-ups, room metadata) can only be tested by Jake in Owlbear.
- Pull before editing: other sessions push to this repo too.
- After pushing: tell Jake to reload with Ctrl+Shift+R, and say whether the Sheet Bridge (Apps Script) needs a new
  deployment (with the link) or not.
