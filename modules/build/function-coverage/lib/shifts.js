// @ts-nocheck
// Shift-requirement helpers. Function Coverage requirements reference
// actual shift definitions by id — start/end/paid/RDO live on the shift.
import { lineRoleKey } from "./duty.js";

let api = null;

export function bindShiftsApi(scheduler) {
  api = scheduler;
}

export function num0(v) {
  return Math.max(0, Math.floor(+v || 0));
}

export function emptyRequirements() {
  return { STSO: {}, LTSO: {}, TSO: {} };
}

export function normalizeRequirements(reqs) {
  var out = emptyRequirements();
  if (!reqs || typeof reqs !== "object") return out;
  ["STSO", "LTSO", "TSO"].forEach(function (role) {
    var src = reqs[role];
    if (!src || typeof src !== "object") return;
    Object.keys(src).forEach(function (shiftId) {
      if (!shiftId) return;
      var rec = src[shiftId] || {};
      var min = num0(rec.min);
      var max = rec.max == null ? min : num0(rec.max);
      if (max < min) max = min;
      out[role][String(shiftId)] = { min: min, max: max };
    });
  });
  return out;
}

export function configuredShiftIdsFromRequirements(fc) {
  var ids = [];
  var seen = {};
  if (fc && Array.isArray(fc.requirementShiftIds)) {
    fc.requirementShiftIds.forEach(function (id) {
      var key = String(id || "");
      if (!key || seen[key]) return;
      seen[key] = true;
      ids.push(key);
    });
  }
  var reqs = (fc && fc.requirements) || {};
  ["STSO", "LTSO", "TSO"].forEach(function (role) {
    var rec = reqs[role] || {};
    Object.keys(rec).forEach(function (id) {
      var key = String(id || "");
      if (!key || seen[key]) return;
      seen[key] = true;
      ids.push(key);
    });
  });
  return ids;
}

export function getConfiguredFunctionShifts(fc) {
  fc = fc || (api && api.state && api.state.functionCoverage) || {};
  if (!api || typeof api.getShift !== "function") return [];
  return configuredShiftIdsFromRequirements(fc).map(function (id) {
    return api.getShift(id);
  }).filter(Boolean);
}

export function getShiftRequirement(role, shiftId, fc) {
  fc = fc || (api && api.state && api.state.functionCoverage) || {};
  var rec = fc.requirements && fc.requirements[role] && fc.requirements[role][shiftId];
  if (!rec) return { min: 0, max: 0 };
  var min = num0(rec.min);
  var max = rec.max == null ? min : num0(rec.max);
  if (max < min) max = min;
  return { min: min, max: max };
}

export function setShiftRequirement(role, shiftId, min, max, fc) {
  fc = fc || (api && api.state && api.state.functionCoverage);
  if (!fc) return null;
  if (!fc.requirements) fc.requirements = emptyRequirements();
  if (!fc.requirements[role]) fc.requirements[role] = {};
  var nMin = num0(min);
  var nMax = max == null ? nMin : num0(max);
  if (nMax < nMin) nMax = nMin;
  fc.requirements[role][String(shiftId)] = { min: nMin, max: nMax };
  return fc.requirements[role][String(shiftId)];
}

export function getEligibleLinesForShift(role, shiftId, opts) {
  opts = opts || {};
  if (!api || !api.state) return [];
  var lines = api.state.lines || [];
  return lines.filter(function (l) {
    if (!l) return false;
    if (l.isExtra || l.extraPositionId) return false;
    if (!l.shiftId || String(l.shiftId) !== String(shiftId)) return false;
    if (typeof api.getShift === "function" && !api.getShift(l.shiftId)) return false;
    if (lineRoleKey(l) !== role) return false;
    if (opts.sex && l.sex !== opts.sex) return false;
    return true;
  });
}

export function openingAndClosingShifts() {
  var shifts = (api && api.state && api.state.shifts) || [];
  var openShift = null, closeShift = null;
  shifts.forEach(function (s) {
    if (!s || !s.id) return;
    var m = api.timeToMin ? api.timeToMin(s.start) : 0;
    if (!openShift || m < api.timeToMin(openShift.start)) openShift = s;
    if (!closeShift || m > api.timeToMin(closeShift.start)) closeShift = s;
  });
  return { open: openShift, close: closeShift };
}

export function lineOnShift(line, shift) {
  return !!(line && shift && String(line.shiftId) === String(shift.id));
}

export function formatRequirementDiagnostic(row) {
  if (!row) return "";
  var req = (row.requiredMin != null ? row.requiredMin : 0) + "-" + (row.requiredMax != null ? row.requiredMax : 0);
  return row.role + " / Shift " + (row.shiftLabel || row.shiftId) +
    " Eligible: " + row.eligible +
    " Required: " + req +
    " Assigned: " + row.assigned +
    " Status: " + (row.status || "OK");
}
