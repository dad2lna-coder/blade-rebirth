/** RDO counts and placement. Bodies copied from Alpha shiftMath.js. */
import { assignBlockRdos } from "./rdoAssign.js";
import { getShift } from "./shiftClock.js";

export function consecutiveRdos(count, start) {
  var n = Math.max(1, Math.min(6, count || 2));
  var out = [];
  for (var i = 0; i < n; i++) out.push((start + i) % 7);
  return out;
}


/** "off" | "4x10" | "5x8". Unknown values stay off so legacy hard RDOs keep working. */
export function normalizeRdoMode(raw) {
  var m = "";
  if (raw && typeof raw === "object") m = raw.rdoMode != null ? String(raw.rdoMode) : "";
  else if (raw != null) m = String(raw);
  m = m.trim().toLowerCase();
  if (m === "4x10" || m === "4\u00d710" || m === "pair" || m === "consecutive") return "4x10";
  if (m === "5x8" || m === "5\u00d78" || m === "adjacent" || m === "adj") return "5x8";
  return "off";
}

/** Sun=0 … Sat=6, or null when unset. */
export function normalizeConstraintDay(raw) {
  var v = raw;
  if (raw && typeof raw === "object") v = raw.rdoConstraint;
  if (v == null || v === "") return null;
  var n = Number(v);
  if (Number.isInteger(n) && n >= 0 && n <= 6) return n;
  return null;
}

export function rdoModeActive(shift) {
  return normalizeRdoMode(shift) !== "off" && normalizeConstraintDay(shift) != null;
}

function legacyRdoDays(S, shift, rdoCount, seed) {
  var hard = Array.isArray(shift && shift.rdoHard)
    ? shift.rdoHard.map(Number).filter(function (x) { return x >= 0 && x <= 6; })
    : [];
  var rdoDays;
  if (hard.length > 0) {
    rdoDays = hard.slice();
    if (rdoDays.length < rdoCount) {
      for (var d = 0; d < 7 && rdoDays.length < rdoCount; d++) {
        if (rdoDays.indexOf(d) < 0) rdoDays.push(d);
      }
    }
  } else if (S && S.consecutiveRdos) {
    rdoDays = S.consecutiveRdos(rdoCount, seed);
  } else {
    rdoDays = consecutiveRdos(rdoCount, seed);
  }
  while (rdoDays.length < rdoCount) {
    var before = rdoDays.length;
    for (var e = 0; e < 7 && rdoDays.length < rdoCount; e++) {
      if (rdoDays.indexOf(e) < 0) rdoDays.push(e);
    }
    if (rdoDays.length === before) break;
  }
  return { rdoDays: rdoDays, hard: hard.length > 0, mode: "off" };
}

/**
 * Place RDOs for one line.
 * No block: copy hard days and pad Sunday-first, else a soft consecutive block from seed.
 * Block 2–4: a consecutive block, then the pin if it is not already in that block. Flex fills only what is still short.
 * A 4×10 pin is not glued to the block (Tue + Fri–Sat is legal). A 5×8 pin sits inside the two-day block.
 * opts.avoidDays, when passed, keeps non-pin days off days already taken. Omit it for the legacy pick.
 * Split Start2/End2 is time-only; this does not read segments.
 */
export function assignRdoDays(S, shift, rdoCount, seed, opts) {
  var count = Math.max(1, Math.min(6, rdoCount || 2));
  var s = Number(seed);
  if (!Number.isFinite(s)) s = 0;
  s = Math.abs(Math.floor(s));
  var placed = assignBlockRdos(shift, count, s, opts);
  if (placed) return placed;
  return legacyRdoDays(S, shift, count, s);
}

export function targetWorkDays(S, shiftId, empClass) {
  if (empClass === "PT") {
    var days = Math.round(+(S.state && S.state.ptDaysPerWeek));
    return Number.isFinite(days) && days > 0 ? Math.max(1, Math.min(6, days)) : 3;
  }
  if (empClass === "STSO" || empClass === "LTSO") {
    var s0 = getShift(S, shiftId);
    return s0 && (+s0.paid || 8) >= 10 ? 4 : 5;
  }
  var s = getShift(S, shiftId);
  if (s && (+s.paid || 8) >= 10) return 4;
  return 5;
}

export function rdoCountForShift(S, shift, empClass) {
  var work = targetWorkDays(S, shift && shift.id, empClass || "FT");
  return Math.max(1, 7 - work);
}
