// @ts-nocheck
/** Coverage counts from the live session. Alpha opsFte + dash-duty rules. Not a line store. */
import { parseStartDate, addDays, weekdaySun0 } from "../build/period/dates.js";
import { countedSex, linePositionKey } from "../build/fte/gender.js";

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

/** Alpha opsFte gate, then dash / training out. A line that is not counted still counts on a day whose duty is BAG, DFO, or PAX. */
export function lineMatchesCoverageFilter(S, line, dayOff, view) {
  if (!line) return false;
  var counted = S.lineInOpsCoverage
    ? S.lineInOpsCoverage(line)
    : !(line.isExtra || line.extraPositionId || line.isTraining) || !!line.opsFte;
  if (line.opsFte === false) counted = false;

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
    if (line.function === "BAG") duty = "BAG";
    else if (line.function === "DFO" || line.function === "PAX") duty = line.function === "DFO" ? "DFO" : "PAX";
    else if (line.function === "-") duty = "-";
    else if (line.function === "TRAINING" || line.isTraining || line.trainingClass || line.empClass === "ESTI" || line.empClass === "MSTI") duty = "TRAINING";
    else if (counted) duty = "PAX";
    else duty = "";
  }

  var opsDuty = duty === "BAG" || duty === "DFO" || duty === "PAX";
  if (!counted) {
    if (!opsDuty) return false;
  } else {
    if (duty === "-" || line.function === "-") return false;
    if (duty === "TRAINING") return false;
  }

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
    for (var day = 0; day < 7; day++) {
      var dayOff = dowToOffset[day];
      if (dayOff == null) continue;
      if ((S.state.schedule[line.id] || S.state.schedule[String(line.id)] || [])[dayOff] !== "WORK") continue;
      if (!lineMatchesCoverageFilter(S, line, dayOff, view)) continue;
      slots.forEach(function (slot, si) {
        if (!coversSlot(S, line, dayOff, day, slot)) return;
        var sex = countedSex(line);
        if (sex === "M") matrix[si][day].m++;
        else if (sex === "F") matrix[si][day].f++;
        matrix[si][day].t++;
      });
    }
  });

  var dayTotals = [0, 1, 2, 3, 4, 5, 6].map(function (day) {
    var dayOff = dowToOffset[day];
    var m = 0;
    var f = 0;
    var t = 0;
    if (dayOff != null) {
      (S.state.lines || []).forEach(function (line) {
        if (!S.getShift(line.shiftId)) return;
        if ((S.state.schedule[line.id] || S.state.schedule[String(line.id)] || [])[dayOff] !== "WORK") return;
        if (!lineMatchesCoverageFilter(S, line, dayOff, view)) return;
        t++;
        var sex = countedSex(line);
        if (sex === "M") m++;
        else if (sex === "F") f++;
      });
    }
    return { m: m, f: f, t: t };
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

export function positionHeadcount(S) {
  var rows = [];
  var index = {};
  function bucket(key, label) {
    if (!index[key]) {
      index[key] = { key: key, label: label, m: 0, f: 0, t: 0 };
      rows.push(index[key]);
    }
    return index[key];
  }
  (S.state.lines || []).forEach(function (line) {
    var key = linePositionKey(line);
    if (!key) return;
    var label = key;
    if (key === "FT") label = "FT TSO";
    else if (key === "PT") label = "PT TSO";
    else if (key.indexOf("EXTRA:") === 0) label = String(line.extraName || line.position || "Position");
    var row = bucket(key, label);
    row.t++;
    var sex = countedSex(line);
    if (sex === "M") row.m++;
    else if (sex === "F") row.f++;
  });
  var order = { FT: 0, PT: 1, LTSO: 2, STSO: 3 };
  rows.sort(function (a, b) {
    var ao = order[a.key] != null ? order[a.key] : 10;
    var bo = order[b.key] != null ? order[b.key] : 10;
    if (ao !== bo) return ao - bo;
    return String(a.label).localeCompare(String(b.label));
  });
  return rows;
}

export function shiftMix(S) {
  function blank() { return { m: 0, f: 0, t: 0 }; }
  function add(cell, line) {
    cell.t++;
    var sex = countedSex(line);
    if (sex === "M") cell.m++;
    else if (sex === "F") cell.f++;
  }
  var rows = [];
  (S.state.shifts || []).forEach(function (shift) {
    var ft = blank();
    var pt = blank();
    var lt = blank();
    var st = blank();
    (S.state.lines || []).forEach(function (line) {
      if (line.shiftId !== shift.id) return;
      if (line.isTraining || line.trainingClass || line.empClass === "ESTI" || line.empClass === "MSTI") return;
      if (line.isExtra || line.extraPositionId) return;
      if (line.isStso || line.empClass === "STSO") add(st, line);
      else if (line.isLtso || line.empClass === "LTSO") add(lt, line);
      else if (line.empClass === "PT") add(pt, line);
      else if (line.empClass === "FT" || line.empClass === "TSO" || !line.empClass) add(ft, line);
    });
    var all = ft.t + pt.t + lt.t + st.t;
    if (!all) return;
    var windowText = (shift.segments && shift.segments.length === 2)
      ? (shift.segments[0].start + "\u2013" + shift.segments[0].end + " / " + shift.segments[1].start + "\u2013" + shift.segments[1].end)
      : ((shift.start || "") + "\u2013" + (shift.end || ""));
    rows.push({
      id: shift.id,
      name: shift.name || shift.id,
      window: windowText,
      ftM: ft.m,
      ftF: ft.f,
      ftT: ft.t,
      ptM: pt.m,
      ptF: pt.f,
      ptT: pt.t,
      ltsoM: lt.m,
      ltsoF: lt.f,
      ltsoT: lt.t,
      stsoM: st.m,
      stsoF: st.f,
      stsoT: st.t,
      tso: ft.t + pt.t,
      all: all,
    });
  });
  return rows;
}
