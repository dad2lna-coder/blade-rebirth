/** Block placement. Bodies copied from Alpha rdoBlock.js. */
import {
  normalizeRdoBlock,
  normalizeRdoPins,
  pinRequired,
  windowsFor,
  readAvoid,
  sharesNonPin,
  withPins,
  protectPartnerDays,
  pickExclusiveFlex,
  pickFlex,
  sortDays
} from "./rdoBlock.js";

export function assignBlockRdos(shift, rdoCount, seed, opts) {
  var blockSize = normalizeRdoBlock(shift);
  if (!blockSize) return null;
  var pins = normalizeRdoPins(shift);
  var s = Number(seed);
  if (!Number.isFinite(s)) s = 0;
  s = Math.abs(Math.floor(s));
  var count = Math.max(1, Math.min(6, rdoCount || 2));
  if (pinRequired(shift) && !pins.length) {
    return {
      ok: false,
      error: "pin is required but no day is set",
      rdoDays: [],
      hard: false,
      mode: "block",
      block: [],
      flex: [],
      pins: []
    };
  }
  var windows = windowsFor(pins, blockSize, count);
  if (!windows.length) {
    return {
      ok: false,
      error: "checked days do not fit in a " + blockSize + "-day block",
      rdoDays: [],
      hard: false,
      mode: "block",
      block: [],
      flex: [],
      pins: pins
    };
  }
  var avoid = readAvoid(opts);
  var block;
  var flex = [];
  if (!avoid) {
    block = windows[s % windows.length].slice();
  } else {
    block = null;
    for (var i = 0; i < windows.length; i++) {
      var w = windows[(s + i) % windows.length];
      if (sharesNonPin(w, pins, avoid)) continue;
      var baseTry = withPins(w, pins);
      var needTry = count - baseTry.length;
      var picked = [];
      if (needTry > 0) {
        var protect = protectPartnerDays(w, pins, windows, avoid);
        picked = pickExclusiveFlex(baseTry, avoid, protect, needTry, s + 3);
        if (picked.length < needTry) continue;
      }
      block = w.slice();
      flex = picked;
      break;
    }
    if (!block) {
      return {
        ok: false,
        error: "no RDO window left without a shared non-pin day",
        rdoDays: [],
        hard: false,
        mode: "block",
        block: [],
        flex: [],
        pins: pins.slice()
      };
    }
  }
  var days = withPins(block, pins);
  if (!avoid && count - days.length > 0) flex = pickFlex(days, count - days.length, s + 3);
  flex.forEach(function (d) {
    if (days.indexOf(d) < 0) days.push(d);
  });
  return {
    ok: true,
    rdoDays: sortDays(days),
    hard: false,
    mode: "block",
    block: sortDays(block),
    flex: sortDays(flex),
    pins: pins.slice(),
    exceeds: days.length > count
  };
}

/** Callers may copy rdoDays only when this is true. Empty days pad to Fri+Sat. */
export function placedRdosOk(placed) {
  if (!placed || placed.ok === false) return false;
  return !!(placed.rdoDays && placed.rdoDays.length);
}

/** Issues for a locked line whose pin is no longer in its RDOs. Others are kept. */
export function lockedRdoNotes(S, lines) {
  var issues = [];
  var kept = 0;
  (lines || []).forEach(function (l) {
    if (!l) return;
    var sh = S && S.getShift ? S.getShift(l.shiftId) : null;
    if (!sh || !normalizeRdoBlock(sh)) return;
    var pins = normalizeRdoPins(sh);
    var have = (l.rdoDays || []).map(Number);
    var missing = pins.filter(function (d) { return have.indexOf(d) < 0; });
    if (!missing.length) { kept++; return; }
    var count = 2;
    if (S.rdoCountForShift) count = S.rdoCountForShift(sh, l.empClass || "FT");
    else if (S.targetWorkDays) count = Math.max(1, 7 - S.targetWorkDays(sh.id, l.empClass || "FT"));
    var seed = Math.abs(Number(l.id) || 0) % 7;
    var placed = assignBlockRdos(sh, count, seed);
    var label = l.lineCode || l.id || "line";
    if (placedRdosOk(placed)) {
      l.rdoDays = placed.rdoDays;
      l.rdoHard = false;
      issues.push(label + ": locked RDOs refreshed to include the pin.");
    } else {
      issues.push(label + ": locked line is missing the pin and was not given a legacy pattern.");
    }
  });
  if (kept) issues.push(kept + " locked line(s) kept their RDOs.");
  return issues;
}
