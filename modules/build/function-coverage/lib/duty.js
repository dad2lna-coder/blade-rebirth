// @ts-nocheck
// ESM duty helpers — real implementations from js/functions.js (E2.1 subset)
let api = null;

export function bindDutyApi(scheduler) {
  api = scheduler;
}

export function lineRoleKey(line) {
  if (!line) return "TSO";
  if (line.isExtra || line.extraPositionId) return line.empClass || line.position || "EXTRA";
  if (line.isStso || line.empClass === "STSO") return "STSO";
  if (line.isLtso || line.empClass === "LTSO") return "LTSO";
  return "TSO";
}

export function isOpsFunctionRole(line) {
  var role = lineRoleKey(line);
  return role === "STSO" || role === "LTSO" || role === "TSO";
}

export function lineIsDfoTagged(line) {
  if (!line) return false;
  if (line.isExtra || line.extraPositionId) return false;
  return line.function === "DFO" || !!(line.functionEligible && line.functionEligible.dfo);
}
export function getRotationDuty(lineId, dayIndex) {
  var rot = api.state.functionRotation || {};
  var row = rot[String(lineId)] || rot[lineId];
  if (row) {
    var cell = row[dayIndex];
    if (cell == null || cell === "") return null;
    return cell;
  }
  var line = null;
  if (api.state && Array.isArray(api.state.lines)) {
    for (var i = 0; i < api.state.lines.length; i++) {
      if (String(api.state.lines[i].id) === String(lineId)) { line = api.state.lines[i]; break; }
    }
  }
  if (line && (line.function === "BAG" || line.function === "DFO" || line.function === "PAX")) return line.function;
  return null;
}
export function lineStartMin(line) {
  var sh = api.getShift(line.shiftId);
  return sh ? api.timeToMin(sh.start) : 0;
}
export function phaseOfStart(startMin, anchors, threshold) {
  threshold = threshold != null ? threshold : 15;
  anchors = anchors || computeShiftAnchors();
  if (startMin <= anchors.am - threshold && startMin < 11 * 60) return "Opening";
  if (startMin >= anchors.pm + threshold && startMin >= 11 * 60 + 15) return "Closing";
  if (startMin < anchors.pm) return "AM";
  return "PM";
}
export function isAmSide(startMin, anchors, threshold) {
  return phaseOfStart(startMin, anchors, threshold) === "Opening" || phaseOfStart(startMin, anchors, threshold) === "AM";
}
export function lineCoversSlot(line, dayIndex, slotMin) {
  var sched = api.state.schedule[line.id] || api.state.schedule[String(line.id)];
  if (!sched || sched[dayIndex] !== "WORK") return false;
  var dow = dayIndex % 7;
  var base = api.state && api.state.startDate;
  if (base) {
    dow = (api.weekdaySun0 && api.addDays)
      ? api.weekdaySun0(api.addDays(base, dayIndex))
      : (api.dj ? api.dj(base).add(dayIndex).day() : dayIndex % 7);
  }
  var times = api.getEffectiveShiftTimes ? api.getEffectiveShiftTimes(line.shiftId, dow) : null;
  if (!times) {
    var sh = api.getShift(line.shiftId);
    if (!sh) return false;
    times = { start: sh.start, end: sh.end };
  }
  var a = api.timeToMin(times.start), c = api.timeToMin(times.end);
  if (c <= a) return slotMin >= a || slotMin < c;
  return slotMin >= a && slotMin < c;
}
// Legacy: extra-position coverage windows and unmapped fc.bands only.
// Function Coverage assignment no longer uses bands.
export function bandForMinute(m, bands) {
  bands = bands || (api.ensureFunctionCoverage && api.ensureFunctionCoverage().bands) || [];
  if (!Array.isArray(bands) || !bands.length) return null;
  for (var i = 0; i < bands.length; i++) {
    var b = bands[i], s = api.timeToMin(b.start), e = api.timeToMin(b.end);
    if (e <= s) e += 1440;
    var mm = m; if (e > 1440 && mm < s) mm += 1440;
    if (mm >= s && mm < e) return b;
  }
  return null;
}
export function computeShiftAnchors() {
  var starts = {};
  (api.state.lines || []).forEach(function (l) {
    var sh = api.getShift(l.shiftId);
    if (!sh) return;
    var m = api.timeToMin(sh.start);
    starts[m] = (starts[m] || 0) + 1;
  });
  var entries = Object.keys(starts).map(function (k) { return { min: +k, n: starts[k] }; }).sort(function (a, b) { return a.min - b.min; });
  if (!entries.length) return { am: 8 * 60, pm: 14 * 60 };
  var am = entries[0].min, amN = 0;
  entries.forEach(function (e) { if (e.min < 11 * 60 && e.n > amN) { amN = e.n; am = e.min; } });
  var pm = entries[entries.length - 1].min, pmN = 0;
  entries.forEach(function (e) { if (e.min >= 11 * 60 + 15 && e.n > pmN) { pmN = e.n; pm = e.min; } });
  if (pmN === 0) entries.forEach(function (e) { if (e.min >= 12 * 60 && e.n > pmN) { pmN = e.n; pm = e.min; } });
  return { am: am, pm: pm };
}
export function clearLineFunctions() {
  (api.state.lines || []).forEach(function (l) { l.function = ""; l.functionEligible = { dfo: false, bag: false, pax: false }; });
  api.state.functionRotation = {};
}
