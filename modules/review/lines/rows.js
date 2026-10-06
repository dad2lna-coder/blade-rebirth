// @ts-nocheck
import { parseStartDate, addDays, weekdaySun0 } from "../../build/period/dates.js";


const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function padTeamName(name) {
  var raw = String(name || "").trim();
  if (!raw) return "";
  var match = raw.match(/^(\d+)$/);
  return match && Number(match[1]) < 10 ? "0" + match[1] : raw;
}

function rdoText(line) {
  var days = (line.rdoDays || []).map(Number).filter(function (day) {
    return Number.isInteger(day) && day >= 0 && day <= 6;
  });
  var text = days.length
    ? days.map(function (day) { return DAY_NAMES[day] != null ? DAY_NAMES[day] : String(day); }).join(",")
    : "\u2014";
  if (line.rdoHard) text += " (hard)";
  return text;
}

function rotationDuty(S, lineId, dayIndex) {
  if (S && typeof S.getRotationDuty === "function") return S.getRotationDuty(lineId, dayIndex);
  var rot = (S && S.state && S.state.functionRotation) || {};
  var row = rot[String(lineId)] || rot[lineId];
  if (row) {
    var cell = row[dayIndex];
    if (cell == null || cell === "") return null;
    return cell;
  }
  return null;
}

function resolveWorkDayDuty(line, duty) {
  if (duty === "TRAINING") return "TRAINING";
  if (duty === "-" || duty === "BAG" || duty === "PAX" || duty === "DFO") return duty;
  if (line.isTraining || line.trainingClass || line.empClass === "ESTI" || line.empClass === "MSTI" || line.extraName === "ESTI" || line.extraName === "MSTI") {
    return "TRAINING";
  }
  if (line.function === "BAG") return "BAG";
  if (line.function === "DFO" || line.function === "PAX") return "PAX";
  if (line.function === "-") return "-";
  return duty === "BAG" || duty === "PAX" ? duty : null;
}

function offsetForDow(S, dow) {
  var base = parseStartDate(S && S.state && S.state.startDate);
  var days = Math.min(7, (((S && S.state && S.state.weekCount) || 1) * 7));
  for (var off = 0; off < days; off++) {
    if (weekdaySun0(addDays(base, off)) === dow) return off;
  }
  return dow;
}

export { offsetForDow };

function teamFor(S, lineId) {
  if (S && typeof S.teamMetaForLine === "function") return S.teamMetaForLine(lineId);
  var teams = (S && S.teams && S.teams.teams) || [];
  var id = +lineId;
  for (var i = 0; i < teams.length; i++) {
    var members = teams[i].members || [];
    for (var j = 0; j < members.length; j++) {
      if (+members[j] === id) return teams[i];
    }
  }
  return null;
}

export function lineToRow(S, line) {
  if (!line || !S || !S.state) return null;
  var schedule = S.state.schedule || {};
  var shift = S.getShift ? S.getShift(line.shiftId) : null;
  var teamMeta = teamFor(S, line.id);
  var shiftName = line.shiftName || (shift && shift.name) || "";
  var start = line.startTime || (shift && shift.start ? shift.start : "");
  var end = line.endTime || (shift && shift.end ? shift.end : "");
  var defaultWorkLabel = (shift && shift.segments && shift.segments.length === 2)
    ? (shift.segments[0].start + "\u2013" + shift.segments[0].end + " / " + shift.segments[1].start + "\u2013" + shift.segments[1].end)
    : (start && end ? start + "\u2013" + end : start || "WORK");
  var workLabel = line.shiftLabel || defaultWorkLabel;
  var extra = !!(line.isExtra || line.extraPositionId);
  var position = extra
    ? (line.position || line.extraName || "TSO")
    : (line.isStso || line.empClass === "STSO" ? "STSO" :
      line.isLtso || line.empClass === "LTSO" ? "LTSO" : "TSO");
  var emp = extra
    ? (line.empClass === "PT" ? "PT" : "FT")
    : (position === "STSO" || position === "LTSO" ? "FT" :
      line.empClass === "PT" ? "PT" : "FT");
  var paid = line.paid || 0;
  var rowSchedule = schedule[line.id] || schedule[String(line.id)] || [];
  var days = [];
  var dayDuties = [];
  var dayStarts = [];
  var dayEnds = [];
  var hours = 0;

  for (var day = 0; day < 7; day++) {
    var off = offsetForDow(S, day);
    var dayCustom = line.dayTimes && line.dayTimes[String(off)];
    var effStart = (dayCustom && dayCustom.start) || start;
    var effEnd = (dayCustom && dayCustom.end) || end;
    dayStarts.push(effStart);
    dayEnds.push(effEnd);
    var value = rowSchedule[off];
    if (value === "WORK") {
      hours += paid;
      var duty = rotationDuty(S, line.id, off);
      days.push(workLabel);
      dayDuties.push(resolveWorkDayDuty(line, duty) || "PAX");
    } else {
      days.push("RDO");
      dayDuties.push("OFF");
    }
  }

  return {
    id: line.id,
    teamId: (teamMeta && teamMeta.id) || "",
    shiftId: line.shiftId || "",
    team: padTeamName((teamMeta && (teamMeta.name || teamMeta.id)) || ""),
    line: line.lineCode || "",
    shift: shiftName,
    start: start,
    end: end,
    position: position,
    emp: emp,
    sex: line.sex === "F" || line.sex === "M" ? line.sex : "",
    function: line.function || "",
    certPool: line.certPool || "",
    rdos: rdoText(line),
    paid: paid,
    days: days,
    dayDuties: dayDuties,
    dayStarts: dayStarts,
    dayEnds: dayEnds,
    hours: hours,
  };
}

export function rowsFromSession(S) {
  var lines = (S && S.state && S.state.lines) || [];
  if (!Array.isArray(lines)) return [];
  return lines.map(function (line) { return lineToRow(S, line); }).filter(Boolean);
}

export function rowMatches(row, filter) {
  filter = filter || {};
  var q = String(filter.search || "").trim().toLowerCase();
  if (q) {
    var hay = [row.line, row.shift, row.position, row.emp, row.team, row.function, row.certPool, row.sex]
      .join(" ")
      .toLowerCase();
    if (hay.indexOf(q) < 0) return false;
  }
  if (filter.role && filter.role !== "ALL" && row.position !== filter.role) return false;
  if (filter.emp && row.emp !== filter.emp) return false;
  if (filter.shift && row.shiftId !== filter.shift) return false;
  if (filter.sex && row.sex !== filter.sex) return false;
  if (filter.team === "__none__") {
    if (row.teamId || row.team) return false;
  } else if (filter.team && row.teamId !== filter.team) return false;
  if (filter.duty) {
    var duties = row.dayDuties || [];
    if (filter.duty === "OFF") {
      if (duties.indexOf("OFF") < 0 && (row.days || []).indexOf("RDO") < 0) return false;
    } else if (row.function !== filter.duty && duties.indexOf(filter.duty) < 0) return false;
  }
  return true;
}
