// @ts-nocheck
/** Coverage counts from the live session. Alpha opsFte + dash-duty rules. Not a line store. */
import { parseStartDate, addDays, weekdaySun0 } from "../setup-panel/utils/dates.js";

var DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function slotLabel(mins) {
  var h = Math.floor(mins / 60);
  var mm = mins % 60;
  return String(h).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
}

export function coverageSlots(S) {
  var openMin = S.timeToMin(S.state.open);
  var closeMin = S.timeToMin(S.state.close);
  var start = Math.floor(openMin / 30) * 30;
  var end = Math.ceil(closeMin / 30) * 30;
  var slots = [];
  for (var m = start; m < end; m += 30) slots.push(m);
  return slots;
}

function rotationDuty(S, lineId, dayOff) {
  if (S.getRotationDuty) return S.getRotationDuty(lineId, dayOff);
  var rot = (S.state && S.state.functionRotation) || {};
  var row = rot[String(lineId)] || rot[lineId];
  if (row) {
    var cell = row[dayOff];
    if (cell == null || cell === "") return null;
    return cell;
  }
  var lines = (S.state && S.state.lines) || [];
  for (var i = 0; i < lines.length; i++) {
    if (String(lines[i].id) === String(lineId)) {
      var fn = lines[i].function;
      if (fn === "BAG" || fn === "DFO" || fn === "PAX") return fn;
      return null;
    }
  }
  return null;
}

/** Alpha lineMatchesCoverageFilter: ops FTE, then dash / training out, then role + duty view. */
export function lineMatchesCoverageFilter(S, line, dayOff, view) {
  if (!line) return false;
  var inOps = S.lineInOpsCoverage
    ? S.lineInOpsCoverage(line)
    : (line.isExtra || line.extraPositionId || line.isTraining ? !!line.opsFte : true);
  if (!inOps || line.opsFte === false) return false;

  var cv = view || S.coverageView || { stso: false, ltso: false, tso: true, funcView: "all" };
  var role = S.lineRoleKey ? S.lineRoleKey(line) : "TSO";
  if (role === "STSO" && !cv.stso) return false;
  if (role === "LTSO" && !cv.ltso) return false;
  if (role === "TSO" && !cv.tso) return false;
  if (role !== "STSO" && role !== "LTSO" && role !== "TSO" && !cv.tso) return false;

  var rawDuty = rotationDuty(S, line.id, dayOff);
  var duty = rawDuty ? String(rawDuty).toUpperCase() : null;
  if (duty === "BAGGAGE") duty = "BAG";
  if (duty === "PASSENGER") duty = "PAX";
  if (!duty) {
    duty = line.function === "BAG" ? "BAG" : (line.function === "DFO" || line.function === "PAX" ? "PAX" : (line.function === "-" ? "-" : (line.isTraining || line.trainingClass || line.empClass === "ESTI" || line.empClass === "MSTI" ? "TRAINING" : "PAX")));
  }

  if (duty === "-" || line.function === "-") return false;
  if (duty === "TRAINING") return false;

  var fv = cv.funcView || "all";
  if (fv === "all") return true;
  if (fv === "dfo") {
    return line.function === "DFO" || !!(line.functionEligible && (line.functionEligible.dfo || line.functionEligible.DFO));
  }
  if (fv === "bag") return duty === "BAG";
  if (fv === "pax") return duty !== "BAG";
  return true;
}

function coversSlot(S, line, off, dow, slot) {
  if (S.lineCoversSlot) return S.lineCoversSlot(line, off, slot);
  var shift = S.getShift(line.shiftId);
  var times = S.getEffectiveShiftTimes
    ? S.getEffectiveShiftTimes(line.shiftId, dow)
    : { start: shift.start, end: shift.end };
  var a = S.timeToMin(times.start);
  var b = S.timeToMin(times.end);
  return b <= a ? (slot >= a || slot < b) : (slot >= a && slot < b);
}

export function computeHourlyByDow(S, view) {
  var slots = coverageSlots(S);
  var base = parseStartDate(S.state.startDate);
  var dowToOffset = {};
  var days = Math.min(7, (S.state.weekCount || 1) * 7);
  for (var off = 0; off < days; off++) {
    var dow = weekdaySun0(addDays(base, off));
    if (dowToOffset[dow] == null) dowToOffset[dow] = off;
  }
  var matrix = slots.map(function () {
    return [0, 1, 2, 3, 4, 5, 6].map(function () { return { m: 0, f: 0, t: 0 }; });
  });

  (S.state.lines || []).forEach(function (line) {
    if (!S.getShift(line.shiftId)) return;
    var isM = line.sex === "M";
    for (var day = 0; day < 7; day++) {
      var dayOff = dowToOffset[day];
      if (dayOff == null) continue;
      if ((S.state.schedule[line.id] || S.state.schedule[String(line.id)] || [])[dayOff] !== "WORK") continue;
      if (!lineMatchesCoverageFilter(S, line, dayOff, view)) continue;
      slots.forEach(function (slot, si) {
        if (!coversSlot(S, line, dayOff, day, slot)) return;
        if (isM) matrix[si][day].m++;
        else matrix[si][day].f++;
        matrix[si][day].t++;
      });
    }
  });

  var dayTotals = [0, 1, 2, 3, 4, 5, 6].map(function (day) {
    var dayOff = dowToOffset[day];
    var m = 0;
    var f = 0;
    if (dayOff != null) {
      (S.state.lines || []).forEach(function (line) {
        if (!S.getShift(line.shiftId)) return;
        if ((S.state.schedule[line.id] || S.state.schedule[String(line.id)] || [])[dayOff] !== "WORK") return;
        if (!lineMatchesCoverageFilter(S, line, dayOff, view)) return;
        if (line.sex === "M") m++;
        else f++;
      });
    }
    return { m: m, f: f, t: m + f };
  });

  var allVals = [];
  matrix.forEach(function (row) { row.forEach(function (cell) { allVals.push(cell.t); }); });
  var lo = allVals.length ? Math.min.apply(null, allVals) : 0;
  var hi = allVals.length ? Math.max.apply(null, allVals) : 0;
  var avg = allVals.reduce(function (a, b) { return a + b; }, 0) / Math.max(1, allVals.length);

  return {
    slots: slots,
    matrix: matrix,
    dowToOffset: dowToOffset,
    dayTotals: dayTotals,
    days: DAY_NAMES,
    lo: lo,
    hi: hi,
    avg: avg,
  };
}

/** Line-level BAG / DFO / PAX using the same ops and dash exclusions, ignoring the role toggles. */
export function dutySnapshot(S) {
  var openView = { stso: true, ltso: true, tso: true, funcView: "all" };
  var out = { BAG: 0, DFO: 0, PAX: 0 };
  (S.state.lines || []).forEach(function (line) {
    if (!lineMatchesCoverageFilter(S, line, 0, openView)) return;
    var fn = line.function === "BAG" ? "BAG" : (line.function === "DFO" ? "DFO" : "PAX");
    out[fn]++;
  });
  return out;
}

export function shiftMix(S) {
  var counts = {};
  (S.state.lines || []).forEach(function (line) {
    var key = line.shiftId + "|" + line.empClass + "|" + (line.sex || "?");
    counts[key] = (counts[key] || 0) + 1;
  });
  var rows = [];
  (S.state.shifts || []).forEach(function (shift) {
    function n(emp, sex) { return counts[shift.id + "|" + emp + "|" + sex] || 0; }
    var ftm = n("FT", "M");
    var ftf = n("FT", "F");
    var ptm = n("PT", "M");
    var ptf = n("PT", "F");
    var ltm = n("LTSO", "M");
    var ltf = n("LTSO", "F");
    var stm = n("STSO", "M");
    var stf = n("STSO", "F");
    var tso = ftm + ftf + ptm + ptf;
    var all = tso + ltm + ltf + stm + stf;
    if (!all) return;
    var windowText = (shift.segments && shift.segments.length === 2)
      ? (shift.segments[0].start + "\u2013" + shift.segments[0].end + " / " + shift.segments[1].start + "\u2013" + shift.segments[1].end)
      : ((shift.start || "") + "\u2013" + (shift.end || ""));
    rows.push({
      id: shift.id,
      name: shift.name || shift.id,
      window: windowText,
      ftM: ftm,
      ftF: ftf,
      ptM: ptm,
      ptF: ptf,
      ltsoM: ltm,
      ltsoF: ltf,
      stsoM: stm,
      stsoF: stf,
      tso: tso,
      all: all,
    });
  });
  return rows;
}
