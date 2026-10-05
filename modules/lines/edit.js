// @ts-nocheck
/** Inline line edits. Mutates the setup session in place — not a second store. */
import { notifySessionLines } from "../setup-panel/sessionBus.js";
import { parseStartDate, addDays, weekdaySun0 } from "../setup-panel/utils/dates.js";
import { offsetForDow } from "./rows.js";

function findLine(S, lineId) {
  if (S && typeof S.findLineById === "function") return S.findLineById(lineId);
  var want = String(lineId);
  var lines = (S && S.state && S.state.lines) || [];
  for (var i = 0; i < lines.length; i++) {
    if (String(lines[i].id) === want) return lines[i];
  }
  return null;
}

function applyLineEmp(line, emp) {
  if (!line) return;
  var v = String(emp == null ? "" : emp).trim();
  var extra = !!(line.isExtra || line.extraPositionId);
  if (extra) {
    if (v === "PT") line.empClass = "PT";
    else if (v === "FT" || v === "TSO") line.empClass = "FT";
    line.isStso = false;
    line.isLtso = false;
    return;
  }
  if (v === "STSO") {
    line.empClass = "STSO";
    line.position = "STSO";
    line.isStso = true;
    line.isLtso = false;
    return;
  }
  if (v === "LTSO") {
    line.empClass = "LTSO";
    line.position = "LTSO";
    line.isStso = false;
    line.isLtso = true;
    return;
  }
  if (v === "FT" || v === "PT" || v === "TSO") {
    line.empClass = v === "PT" ? "PT" : "FT";
    line.position = "TSO";
    line.isStso = false;
    line.isLtso = false;
    return;
  }
  if (v) {
    line.empClass = v;
    line.position = v;
    line.isStso = false;
    line.isLtso = false;
  }
}

function applyLineShift(S, line, shiftId) {
  var def = S.getShift && S.getShift(shiftId);
  if (!def || !line) return;
  line.shiftId = def.id;
  line.shiftName = def.name;
  line.shiftLabel = S.shiftLabel ? S.shiftLabel(def) : (def.start || "") + "-" + (def.end || "");
  line.paid = def.paid || line.paid || 8;
}

function setLineTeam(S, lineId, teamId) {
  if (S && typeof S.setLineTeam === "function") {
    S.setLineTeam(lineId, teamId);
    return;
  }
  var id = +lineId;
  var teams = S && S.teams && S.teams.teams;
  if (!teams) return;
  teams.forEach(function (team) {
    team.members = (team.members || []).filter(function (member) { return member !== id; });
  });
  if (!teamId) return;
  var team = teams.filter(function (item) { return item.id === teamId; })[0];
  if (team && team.members.indexOf(id) === -1) team.members.push(id);
}

function scheduleArray(S, line) {
  if (!S.state.schedule) S.state.schedule = {};
  var key = Object.prototype.hasOwnProperty.call(S.state.schedule, line.id)
    ? line.id
    : (Object.prototype.hasOwnProperty.call(S.state.schedule, String(line.id)) ? String(line.id) : line.id);
  if (!Array.isArray(S.state.schedule[key])) S.state.schedule[key] = Array(7).fill("RDO");
  while (S.state.schedule[key].length < 7) S.state.schedule[key].push("RDO");
  return { key: key, row: S.state.schedule[key] };
}

function setRotationDuty(S, lineId, dayIndex, duty) {
  var key = String(lineId);
  if (!S.state.functionRotation) S.state.functionRotation = {};
  if (!S.state.functionRotation[key] && S.state.functionRotation[lineId]) {
    S.state.functionRotation[key] = S.state.functionRotation[lineId];
  }
  if (!S.state.functionRotation[key]) S.state.functionRotation[key] = [];
  while (S.state.functionRotation[key].length <= dayIndex) S.state.functionRotation[key].push(null);
  S.state.functionRotation[key][dayIndex] = duty;
}

function syncRdoDays(S, line) {
  if (S.syncRdoDaysFromSchedule) {
    S.syncRdoDaysFromSchedule(line);
    return;
  }
  var packed = scheduleArray(S, line);
  var days = Math.min(7, (S.state.weekCount || 1) * 7);
  var base = parseStartDate(S.state.startDate);
  var set = {};
  for (var d = 0; d < days; d++) {
    if (packed.row[d] === "RDO") set[weekdaySun0(addDays(base, d))] = true;
  }
  line.rdoDays = Object.keys(set).map(Number).sort(function (a, b) { return a - b; });
}

function done() {
  notifySessionLines();
}

export function writeInlineEdit(S, lineId, field, value) {
  var line = findLine(S, lineId);
  if (!line) return;
  if (field === "lineCode") {
    line.lineCode = String(value || "").trim() || line.lineCode;
  } else if (field === "sex") {
    line.sex = value === "F" ? "F" : "M";
  } else if (field === "function") {
    line.function = value === "DFO" || value === "PAX" || value === "BAG" || value === "TRAINING" || value === "-" ? value : "";
  } else if (field === "certPool") {
    var pool = String(value || "").trim().toUpperCase();
    line.certPool = pool === "A" || pool === "B" ? pool : "";
  } else if (field === "emp") {
    if (S.applyLineEmp) S.applyLineEmp(line, value);
    else applyLineEmp(line, value);
  } else if (field === "position") {
    var extra = !!(line.isExtra || line.extraPositionId);
    var pos = String(value == null ? "" : value).trim();
    if (extra) {
      if (pos) {
        line.position = pos;
        line.extraName = pos;
      }
      line.isStso = false;
      line.isLtso = false;
    } else if (S.applyLineEmp) {
      S.applyLineEmp(line, pos);
    } else {
      applyLineEmp(line, pos);
    }
  } else if (field === "shift") {
    if (S.applyLineShift) S.applyLineShift(line, value);
    else applyLineShift(S, line, value);
  } else if (field === "team") {
    setLineTeam(S, lineId, value);
  } else if (field === "start" || field === "end") {
    var timeVal = String(value || "").trim();
    if (S.isValidTimeText && !S.isValidTimeText(timeVal)) return;
    if (field === "start") line.startTime = timeVal;
    if (field === "end") line.endTime = timeVal;
    var shift = S.getShift ? S.getShift(line.shiftId) : null;
    var curStart = line.startTime || (shift ? shift.start : "");
    var curEnd = line.endTime || (shift ? shift.end : "");
    line.shiftLabel = (curStart || "") + "-" + (curEnd || "");
  } else {
    return;
  }
  done();
}

export function writeDayDuty(S, lineId, column, duty) {
  var line = findLine(S, lineId);
  var dayIndex = offsetForDow(S, Number(column));
  var next = String(duty || "").toUpperCase();
  if (!line || !Number.isInteger(dayIndex) || dayIndex < 0) return;
  var packed = scheduleArray(S, line);
  if (next === "OFF" || next === "RDO" || next === "") {
    packed.row[dayIndex] = "RDO";
    setRotationDuty(S, packed.key, dayIndex, null);
  } else {
    packed.row[dayIndex] = "WORK";
    if (next === "BAG") setRotationDuty(S, packed.key, dayIndex, "BAG");
    else if (next === "DFO") setRotationDuty(S, packed.key, dayIndex, "DFO");
    else if (next === "TRAINING") setRotationDuty(S, packed.key, dayIndex, "TRAINING");
    else if (next === "-") setRotationDuty(S, packed.key, dayIndex, "-");
    else setRotationDuty(S, packed.key, dayIndex, "PAX");
  }
  syncRdoDays(S, line);
  done();
}

export function writeDayTime(S, lineId, column, field, value) {
  var line = findLine(S, lineId);
  var dayIndex = offsetForDow(S, Number(column));
  var timeVal = String(value || "").trim();
  if (!line || !Number.isInteger(dayIndex) || dayIndex < 0) return;
  if (S.isValidTimeText && !S.isValidTimeText(timeVal)) return;
  var shift = S.getShift ? S.getShift(line.shiftId) : null;
  var baseStart = line.startTime || (shift ? shift.start : "08:00");
  var baseEnd = line.endTime || (shift ? shift.end : "16:30");
  if (!line.dayTimes) line.dayTimes = {};
  var key = String(dayIndex);
  var cur = line.dayTimes[key] || { start: baseStart, end: baseEnd };
  if (field === "start") line.dayTimes[key] = { start: timeVal, end: cur.end };
  else if (field === "end") line.dayTimes[key] = { start: cur.start, end: timeVal };
  else return;
  done();
}
