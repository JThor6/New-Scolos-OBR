// "Tap twice" buttons (Jake's GM rule: confirm on the SAME button, never a pop-up). Pure.
// The test-mode fight bar: which buttons need a second tap, and what one tap does.
export const BAR_CONFIRM = new Set(["healall", "day", "end"]);
// k: the button tapped; armed: it was already waiting for its second tap. -> { run: do it now, arm: wait for a second tap }
export function barTap(k, armed) {
  if (!BAR_CONFIRM.has(k)) return { run: true, arm: false };
  return armed ? { run: true, arm: false } : { run: false, arm: true };
}
