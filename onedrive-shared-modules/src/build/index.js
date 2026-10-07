import { attachShiftMath } from "./logic/shiftClock.js";

export function initBuild(session) {
  if (!session || !session.timeToMin || !session.isValidTimeText || !session.safeNumber) {
    return { ready: false };
  }
  attachShiftMath(session);
  return { ready: true, scope: "shift-math" };
}
