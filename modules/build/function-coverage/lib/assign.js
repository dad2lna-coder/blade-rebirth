// @ts-nocheck
// Shift-driven function assignment.
// Requirements are (role, shiftId, min, max) counts of generated lines —
// not 30-minute slot headcounts. Coverage slots are derived afterwards.
import { lineRoleKey } from "./duty.js";
import { lineStartMin, isAmSide, computeShiftAnchors } from "./duty.js";
import { ensureFunctionCoverage, capFunctionPoolsToFte, buildCertifiedPools } from "./pools.js";
import {
  getShiftRequirement, getEligibleLinesForShift, openingAndClosingShifts,
  lineOnShift
} from "./shifts.js";

let api = null;

export function bindAssignApi(scheduler) {
  api = scheduler;
}

function worksDay(line, d) {
  var sched = api.state.schedule[line.id] || api.state.schedule[String(line.id)];
  if (!sched) return false;
  return sched[d] === "WORK";
}

function ensureEligible(line) {
  if (!line.functionEligible || typeof line.functionEligible !== "object") {
    line.functionEligible = { dfo: false, bag: false, pax: false };
  }
  return line.functionEligible;
}

function unused(role, sex, fc) {
  var lines = api.state.lines || [];
  return lines.filter(function (l) {
    if (l.isExtra || l.extraPositionId) return false;
    var el = ensureEligible(l);
    return lineRoleKey(l) === role && l.sex === sex && !el.bag && !el.dfo;
  });
}

function sortByBias(arr, fc) {
  return arr.slice().sort(function (a, b) {
    if (fc && fc.bias === "male" && a.sex !== b.sex) return a.sex === "M" ? -1 : 1;
    if (fc && fc.bias === "female" && a.sex !== b.sex) return a.sex === "F" ? -1 : 1;
    return lineStartMin(a) - lineStartMin(b) || String(a.id).localeCompare(String(b.id));
  });
}

function countBagDuties(lineId) {
  var row = api.state.functionRotation && api.state.functionRotation[String(lineId)];
  if (!row) return 0;
  var n = 0;
  for (var i = 0; i < row.length; i++) if (row[i] === "BAG") n++;
  return n;
}

export function markBag(role, sex, n, fc) {
  if (!n || n <= 0) return { total: 0 };
  fc = fc || ensureFunctionCoverage();
  var lines = unused(role, sex, fc).slice();
  lines.sort(function (a, b) {
    return lineStartMin(a) - lineStartMin(b) || String(a.id).localeCompare(String(b.id));
  });
  var taken = 0;
  for (var i = 0; i < lines.length && taken < n; i++) {
    ensureEligible(lines[i]).bag = true;
    taken++;
  }
  return { total: taken };
}

/** Live DFO identity is buildCertifiedPools in pools.js. Kept as a no-op export. */
export function markDfo(role, sex, n, fc) {
  return { am: 0, pm: 0, total: 0 };
}

function paintAfterAssign() {
  if (api.renderCoverageBars) api.renderCoverageBars();
  if (api.renderReports) api.renderReports();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("lines:request-render"));
  }
  if (!api.__USE_SVELTE_LINES && api.renderLines) api.renderLines();
}

function setDuty(lineId, dayIndex, fn) {
  var key = String(lineId);
  if (!api.state.functionRotation) api.state.functionRotation = {};
  if (!api.state.functionRotation[key]) api.state.functionRotation[key] = [];
  while (api.state.functionRotation[key].length <= dayIndex) api.state.functionRotation[key].push(null);
  api.state.functionRotation[key][dayIndex] = fn;
  return true;
}

function getDuty(lineId, dayIndex) {
  var row = api.state.functionRotation && api.state.functionRotation[String(lineId)];
  if (!row) return null;
  var cell = row[dayIndex];
  if (cell == null || cell === "") return null;
  return cell;
}

function shiftLabelOf(shiftId) {
  var sh = api.getShift ? api.getShift(shiftId) : null;
  if (!sh) return String(shiftId);
  var name = sh.name || shiftId;
  return String(name).replace(":", "");
}

function sortRotateCandidates(arr, fc) {
  return arr.slice().sort(function (a, b) {
    var da = countBagDuties(a.id);
    var db = countBagDuties(b.id);
    if (da !== db) return da - db;
    var biased = sortByBias([a, b], fc);
    if (biased[0] !== a) return 1;
    if (biased[0] !== b && a !== b) return -1;
    return String(a.id).localeCompare(String(b.id));
  });
}

/**
 * Diagnostics only. Pool identity (BAG / DFO / PAX) stays with
 * buildCertifiedPools / markBag / markDfo. Shift min/max is applied later
 * as per-day BAG duties on DFO lines — never as a permanent BAG conversion.
 */
export function applyShiftFunctionRequirements(fc) {
  fc = fc || ensureFunctionCoverage();
  var diagnostics = [];
  var configured = {};
  var roles = ["STSO", "LTSO", "TSO"];

  roles.forEach(function (role) {
    var recs = (fc.requirements && fc.requirements[role]) || {};
    Object.keys(recs).forEach(function (shiftId) {
      var req = getShiftRequirement(role, shiftId, fc);
      if (req.min <= 0 && req.max <= 0) return;
      configured[role + "|" + shiftId] = { min: req.min, max: req.max };
      var eligible = getEligibleLinesForShift(role, shiftId);
      var dfoEligible = eligible.filter(function (l) {
        var el = ensureEligible(l);
        return el.dfo && !el.bag;
      });
      var status = (eligible.length < req.min || dfoEligible.length < req.min) ? "SHORT" : "OK";
      var sh = api.getShift ? api.getShift(shiftId) : null;
      diagnostics.push({
        role: role,
        shiftId: shiftId,
        shiftLabel: shiftLabelOf(shiftId),
        shiftStart: sh ? sh.start : null,
        shiftEnd: sh ? sh.end : null,
        missingShift: !sh,
        eligible: eligible.length,
        requiredMin: req.min,
        requiredMax: req.max,
        assigned: Math.min(req.max, Math.max(req.min, 0), eligible.length),
        status: status
      });
    });
  });

  return { diagnostics: diagnostics, configured: configured };
}

/**
 * Rotate BAG work days across DFO-eligible lines on each configured
 * role×shift. Bag-block (eligible.bag) lines are left alone — they stay
 * BAG every work day. DFO identity is not flipped to bag.
 */
export function rotateShiftBagDuties(fc, days) {
  fc = fc || ensureFunctionCoverage();
  days = days || 0;
  var roles = ["STSO", "LTSO", "TSO"];
  var diagnostics = [];

  for (var d = 0; d < days; d++) {
    for (var r = 0; r < roles.length; r++) {
      var role = roles[r];
      var recs = (fc.requirements && fc.requirements[role]) || {};
      var shiftIds = Object.keys(recs);
      for (var s = 0; s < shiftIds.length; s++) {
        var shiftId = shiftIds[s];
        var req = getShiftRequirement(role, shiftId, fc);
        if (req.min <= 0 && req.max <= 0) continue;
        var candidates = getEligibleLinesForShift(role, shiftId).filter(function (l) {
          var el = ensureEligible(l);
          return worksDay(l, d) && !el.bag && el.dfo;
        });
        candidates = sortRotateCandidates(candidates, fc);
        var want = Math.min(req.max, Math.max(req.min, 0));
        want = Math.min(want, candidates.length);
        for (var i = 0; i < want; i++) setDuty(candidates[i].id, d, "BAG");
        if (d === 0) {
          var eligible = getEligibleLinesForShift(role, shiftId);
          var dfoOnShift = eligible.filter(function (l) {
            var el = ensureEligible(l);
            return el.dfo && !el.bag;
          });
          var workingDfo = dfoOnShift.filter(function (l) { return worksDay(l, 0); });
          var status = (dfoOnShift.length < req.min || workingDfo.length < req.min) ? "SHORT" : "OK";
          diagnostics.push({
            role: role,
            shiftId: shiftId,
            requiredMin: req.min,
            requiredMax: req.max,
            eligible: eligible.length,
            assigned: want,
            status: status
          });
        }
      }
    }
  }
  return diagnostics;
}

export function generateFunctionAssignments(opts) {
  opts = opts || {};
  if (api.readFunctionBandsFromDom) api.readFunctionBandsFromDom();
  var fc = ensureFunctionCoverage();
  if (!api.state.issues) api.state.issues = [];
  capFunctionPoolsToFte(fc, api.state.issues);
  api.state.functionRotation = {};
  (api.state.lines || []).forEach(function (l) {
    if (l.isExtra || l.extraPositionId) return;
    l.function = "";
    l.functionEligible = { dfo: false, bag: false, pax: false };
  });
  if (!api.state.lines || !api.state.lines.length) {
    fc.lastDiagnostics = [];
    paintAfterAssign();
    if (!opts.fromGenerate && api.updateStatus) api.updateStatus("Generate lines first.");
    return;
  }
  var poolStats = buildCertifiedPools(fc);
  var applied = applyShiftFunctionRequirements(fc);
  fc.lastDiagnostics = applied.diagnostics || [];
  var days = (api.state.weekCount || 1) * 7;

  (api.state.lines || []).forEach(function (l) {
    if (!ensureEligible(l).bag) return;
    l.function = "BAG";
    for (var d = 0; d < days; d++) if (worksDay(l, d)) setDuty(l.id, d, "BAG");
  });
  (api.state.lines || []).forEach(function (l) {
    if (ensureEligible(l).bag) return;
    if (ensureEligible(l).dfo) l.function = "DFO";
  });

  var rotated = rotateShiftBagDuties(fc, days);
  if (rotated && rotated.length) {
    (applied.diagnostics || []).forEach(function (row) {
      for (var i = 0; i < rotated.length; i++) {
        if (rotated[i].role !== row.role || rotated[i].shiftId !== row.shiftId) continue;
        row.assigned = rotated[i].assigned;
        if (rotated[i].status === "SHORT") row.status = "SHORT";
      }
    });
  }

  (api.state.lines || []).forEach(function (l) {
    if (l.isExtra || l.extraPositionId) return;
    if (ensureEligible(l).bag) return;
    if (ensureEligible(l).dfo) {
      for (var di = 0; di < days; di++) {
        if (!worksDay(l, di)) continue;
        if (!getDuty(l.id, di)) setDuty(l.id, di, "DFO");
      }
      return;
    }
    ensureEligible(l).pax = true;
    l.function = "PAX";
    for (var dj = 0; dj < days; dj++) if (worksDay(l, dj)) setDuty(l.id, dj, "PAX");
  });

  var shortfalls = [];
  (applied.diagnostics || []).forEach(function (row) {
    if (row.status !== "SHORT") return;
    var label = row.shiftStart || row.shiftLabel || row.shiftId;
    var msg = row.role + " " + label + " shift: " + row.assigned + " / " + row.requiredMin;
    shortfalls.push(msg);
    api.state.issues.push(msg);
  });
  if (shortfalls.length && api.renderIssues) api.renderIssues();

  paintAfterAssign();
  var msg = "BAG " + (poolStats.bag.stso.total + poolStats.bag.ltso.total + poolStats.bag.tso.total) +
    " \u00b7 DFO " + (poolStats.stso.total + poolStats.ltso.total + poolStats.tso.total) + " \u00b7 leftover PAX";
  if (shortfalls.length) msg += " \u00b7 SHORT " + shortfalls.length;
  var hint = api.$ && api.$("cert-assign-hint"); if (hint) hint.textContent = msg;
  if (!opts.fromGenerate && api.updateStatus) api.updateStatus(msg);
  if (!opts.fromGenerate && api.closeFunctionCoverageModal) api.closeFunctionCoverageModal();
  return { diagnostics: applied.diagnostics, shortfalls: shortfalls, poolStats: poolStats };
}
