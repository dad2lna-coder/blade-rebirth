/** Shift lookup, segments, coverage windows, normalize. Bodies copied from Alpha shiftMath.js. */
import { normalizeRdoBlock, normalizeRdoPins } from "./rdoBlock.js";
import { normalizeShift } from "./shiftNormalize.js";
import {
  targetWorkDays,
  consecutiveRdos,
  normalizeRdoMode,
  normalizeConstraintDay,
  rdoModeActive,
  assignRdoDays,
  rdoCountForShift
} from "./rdoDays.js";

export function getShift(S, id) {
  return (S.state.shifts || []).find(function (x) { return x.id === id; });
}

export function shiftBadge(S, id) {
  var i = (S.state.shifts || []).findIndex(function (x) { return x.id === id; });
  return S.BADGES[(i >= 0 ? i : 0) % S.BADGES.length];
}

export function shiftLabel(s) {
  if (!s) return "\u2014";
  if (s.segments && Array.isArray(s.segments) && s.segments.length === 2) {
    return String(s.segments[0].start).replace(":", "") + "-" + String(s.segments[0].end).replace(":", "") +
      " / " + String(s.segments[1].start).replace(":", "") + "-" + String(s.segments[1].end).replace(":", "");
  }
  return String(s.start).replace(":", "") + "-" + String(s.end).replace(":", "");
}

export function getEffectiveShiftSegments(S, shiftId, dow) {
  var s = getShift(S, shiftId);
  if (!s) return [{ start: "00:00", end: "00:00" }];
  var key = String(dow);
  if (s.dayTimes && s.dayTimes[key]) {
    var dt = s.dayTimes[key];
    if (dt.segments && Array.isArray(dt.segments) && dt.segments.length === 2) {
      if (S.isValidTimeText(dt.segments[0].start) && S.isValidTimeText(dt.segments[0].end) &&
          S.isValidTimeText(dt.segments[1].start) && S.isValidTimeText(dt.segments[1].end)) {
        return [
          { start: dt.segments[0].start, end: dt.segments[0].end },
          { start: dt.segments[1].start, end: dt.segments[1].end }
        ];
      }
    }
    if (S.isValidTimeText(dt.start) && S.isValidTimeText(dt.end)) {
      return [{ start: dt.start, end: dt.end }];
    }
  }
  if (s.segments && Array.isArray(s.segments) && s.segments.length === 2) {
    return [
      { start: s.segments[0].start, end: s.segments[0].end },
      { start: s.segments[1].start, end: s.segments[1].end }
    ];
  }
  return [{ start: s.start, end: s.end }];
}

export function getEffectiveShiftTimes(S, shiftId, dow) {
  var s = getShift(S, shiftId);
  if (!s) return { start: "00:00", end: "00:00", isOverride: false };
  var key = String(dow);
  if (s.dayTimes && s.dayTimes[key] &&
      S.isValidTimeText(s.dayTimes[key].start) &&
      S.isValidTimeText(s.dayTimes[key].end)) {
    return { start: s.dayTimes[key].start, end: s.dayTimes[key].end, isOverride: true };
  }
  return { start: s.start, end: s.end, isOverride: false };
}

export function shiftHasDayOverrides(S, shiftId) {
  var s = getShift(S, shiftId);
  return !!(s && s.dayTimes && Object.keys(s.dayTimes).length);
}

export function shiftCoversSlot(S, shiftId, slotStart, dow) {
  var segs = (dow != null) ? getEffectiveShiftSegments(S, shiftId, dow) : null;
  if (!segs) {
    var s = getShift(S, shiftId);
    if (!s) return false;
    segs = s.segments && s.segments.length === 2 ? s.segments : [{ start: s.start, end: s.end }];
  }
  for (var i = 0; i < segs.length; i++) {
    var seg = segs[i];
    var a = S.timeToMin(seg.start);
    var b = S.timeToMin(seg.end);
    if (b <= a) {
      if (slotStart >= a || slotStart < b) return true;
    } else {
      if (slotStart >= a && slotStart < b) return true;
    }
  }
  return false;
}

export function shiftOverlapsWindow(S, s, openMin, closeMin) {
  if (!s) return false;
  return S.timeToMin(s.start) < closeMin && S.timeToMin(s.end) > openMin;
}

export function getBandKey(S, shiftId) {
  var s = getShift(S, shiftId);
  if (!s) return String(shiftId || "");
  if (s.crewGroupId && S && S.state && Array.isArray(S.state.shiftCrewGroups)) {
    var grp = S.state.shiftCrewGroups.find(function (g) { return g && g.id === s.crewGroupId; });
    if (grp && Array.isArray(grp.shiftIds) && grp.shiftIds.indexOf(s.id) >= 0) {
      return grp.id;
    }
  }
  return s.id;
}

export function attachShiftMath(S) {
  if (!S) return;
  S.getShift = function (id) { return getShift(S, id); };
  S.shiftBadge = function (id) { return shiftBadge(S, id); };
  S.shiftLabel = shiftLabel;
  S.getEffectiveShiftSegments = function (shiftId, dow) { return getEffectiveShiftSegments(S, shiftId, dow); };
  S.getEffectiveShiftTimes = function (shiftId, dow) { return getEffectiveShiftTimes(S, shiftId, dow); };
  S.shiftHasDayOverrides = function (shiftId) { return shiftHasDayOverrides(S, shiftId); };
  S.shiftCoversSlot = function (shiftId, slotStart, dow) { return shiftCoversSlot(S, shiftId, slotStart, dow); };
  S.shiftOverlapsWindow = function (s, openMin, closeMin) { return shiftOverlapsWindow(S, s, openMin, closeMin); };
  S.targetWorkDays = function (shiftId, empClass) { return targetWorkDays(S, shiftId, empClass); };
  S.consecutiveRdos = consecutiveRdos;
  S.normalizeRdoMode = normalizeRdoMode;
  S.normalizeConstraintDay = normalizeConstraintDay;
  S.rdoModeActive = rdoModeActive;
  S.normalizeRdoBlock = normalizeRdoBlock;
  S.normalizeRdoPins = normalizeRdoPins;
  S.assignRdoDays = function (shift, rdoCount, seed, opts) { return assignRdoDays(S, shift, rdoCount, seed, opts); };
  S.rdoCountForShift = function (shift, empClass) { return rdoCountForShift(S, shift, empClass); };
  S.normalizeShift = function (raw, index) { return normalizeShift(S, raw, index); };
  S.getBandKey = function (shiftId) { return getBandKey(S, shiftId); };
}
