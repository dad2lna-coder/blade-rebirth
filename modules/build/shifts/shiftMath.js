// @ts-nocheck
/** Shift lookup, coverage windows, RDO counts, normalize. */
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

export function consecutiveRdos(count, start) {
  var n = Math.max(1, Math.min(6, count || 2));
  var out = [];
  for (var i = 0; i < n; i++) out.push((start + i) % 7);
  return out;
}

export function rdoCountForShift(S, shift, empClass) {
  var work = targetWorkDays(S, shift && shift.id, empClass || "FT");
  return Math.max(1, 7 - work);
}

export function normalizeShift(S, raw, index) {
  var fallbackId = "S" + (index + 1);
  var id = raw && raw.id ? String(raw.id) : fallbackId;
  var name = raw && raw.name ? String(raw.name) : id;

  var segments = null;
  if (raw && raw.segments && Array.isArray(raw.segments) && raw.segments.length === 2) {
    var seg0 = raw.segments[0];
    var seg1 = raw.segments[1];
    if (seg0 && seg1 &&
        S.isValidTimeText(seg0.start) && S.isValidTimeText(seg0.end) &&
        S.isValidTimeText(seg1.start) && S.isValidTimeText(seg1.end)) {
      var m0Start = S.timeToMin(seg0.start);
      var m0End = S.timeToMin(seg0.end);
      var m1Start = S.timeToMin(seg1.start);
      var m1End = S.timeToMin(seg1.end);
      if (m0End > m0Start && m1End > m1Start && m1Start > m0End) {
        segments = [
          { start: seg0.start, end: seg0.end },
          { start: seg1.start, end: seg1.end }
        ];
      }
    }
  }

  var start = segments ? segments[0].start : (raw && S.isValidTimeText(raw.start) ? raw.start : "08:00");
  var end = segments ? segments[1].end : (raw && S.isValidTimeText(raw.end) ? raw.end : "16:30");

  var paid = S.safeNumber(raw && raw.paid, 8, 1, 24);
  var force = Math.floor(S.safeNumber(raw && raw.force, 0, 0, null));
  var ltsoForce = Math.floor(S.safeNumber(raw && raw.ltsoForce, 0, 0, null));
  var stsoForce = Math.floor(S.safeNumber(raw && raw.stsoForce, 0, 0, null));
  var rdoHard = Array.isArray(raw && raw.rdoHard)
    ? raw.rdoHard.map(Number).filter(function (x) {
        return Number.isInteger(x) && x >= 0 && x <= 6;
      })
    : [];

  var dayTimes = null;
  if (raw && raw.dayTimes && typeof raw.dayTimes === "object") {
    dayTimes = {};
    for (var k in raw.dayTimes) {
      if (!Object.prototype.hasOwnProperty.call(raw.dayTimes, k)) continue;
      var dt = raw.dayTimes[k];
      if (dt) {
        if (dt.segments && Array.isArray(dt.segments) && dt.segments.length === 2) {
          var d0 = dt.segments[0], d1 = dt.segments[1];
          if (d0 && d1 && S.isValidTimeText(d0.start) && S.isValidTimeText(d0.end) &&
              S.isValidTimeText(d1.start) && S.isValidTimeText(d1.end)) {
            var dm0s = S.timeToMin(d0.start), dm0e = S.timeToMin(d0.end);
            var dm1s = S.timeToMin(d1.start), dm1e = S.timeToMin(d1.end);
            if (dm0e > dm0s && dm1e > dm1s && dm1s > dm0e) {
              dayTimes[String(k)] = {
                start: d0.start,
                end: d1.end,
                segments: [
                  { start: d0.start, end: d0.end },
                  { start: d1.start, end: d1.end }
                ]
              };
              continue;
            }
          }
        }
        if (S.isValidTimeText(dt.start) && S.isValidTimeText(dt.end)) {
          dayTimes[String(k)] = { start: dt.start, end: dt.end };
        }
      }
    }
    if (!Object.keys(dayTimes).length) dayTimes = null;
  }

  var phase = (raw && raw.phase) || "auto";
  if (["auto", "opening", "am", "pm", "closing"].indexOf(phase) < 0) phase = "auto";
  var crewGroupId = raw && raw.crewGroupId ? String(raw.crewGroupId) : "";

  var result = {
    id: id, name: name, start: start, end: end, paid: paid,
    force: force, ltsoForce: ltsoForce, stsoForce: stsoForce, rdoHard: rdoHard,
    dayTimes: dayTimes, phase: phase, crewGroupId: crewGroupId
  };
  if (segments) result.segments = segments;
  return result;
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
  S.rdoCountForShift = function (shift, empClass) { return rdoCountForShift(S, shift, empClass); };
  S.normalizeShift = function (raw, index) { return normalizeShift(S, raw, index); };
  S.getBandKey = function (shiftId) { return getBandKey(S, shiftId); };
}
