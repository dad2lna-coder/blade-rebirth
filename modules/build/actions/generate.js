// @ts-nocheck
/** Main generation orchestrator. Coordinates setup reads → validation →
 *  allocation → line building → schedule building → team formation → UI refresh.
 *  Heavy logic is extracted to dedicated modules; this file is a thin coordinator.
 */
import { buildScheduleForLine } from "../schedule/buildScheduleForLine.js";
import { formExtraTeams } from "../teams/formExtraTeams.js";
import { validateGenerateInputs } from "./validateGenerateInputs.js";
import { notifySessionLines } from "../sessionBus.js";
import { applyPositionGender, genderStatusNote } from "../fte/gender.js";

/** Generate: main controller - orchestrates setup inputs → allocation → line building → results. */
export function generate(S) {
  S.state.issues = [];
  if (S.collectSetupInputs) S.collectSetupInputs();
  if (S.readShiftsFromDom) S.readShiftsFromDom();

  // Handle active seed for generation
  var seedInput = String(S.state.generateSeed || "random").trim().toLowerCase();
  if (!seedInput || seedInput === "random") {
    S.state.activeSeed = Math.floor(Math.random() * 2147483647);
  } else {
    var parsedSeed = parseInt(seedInput, 10);
    S.state.activeSeed = Number.isFinite(parsedSeed) ? Math.abs(parsedSeed) : 42;
  }

  if (!validateGenerateInputs(S)) {
    if (S.renderAll) S.renderAll();
    if (S.updateStatus) S.updateStatus("No shifts defined.");
    notifySessionLines();
    return;
  }

  var existingLockedLines = [];
  if (S.state.lines && Array.isArray(S.state.lines) && S.isLineScheduleLocked) {
    existingLockedLines = S.state.lines.filter(function (l) { return S.isLineScheduleLocked(l); });
  }

  function adjustCountsForLocked(counts, lockedLines, filterFn) {
    var adj = Object.assign({}, counts || {});
    lockedLines.forEach(function (l) {
      if (filterFn(l) && l.shiftId && adj[l.shiftId] > 0) {
        adj[l.shiftId]--;
      }
    });
    return adj;
  }

  var isTsoLine = function (l) {
    if (l.isLtso || l.isStso || l.empClass === "LTSO" || l.empClass === "STSO") return false;
    if (l.isExtra || l.extraPositionId || l.isTraining || l.trainingClass) return false;
    return true;
  };
  var isLtsoLine = function (l) { return l.isLtso || l.empClass === "LTSO"; };
  var isStsoLine = function (l) { return l.isStso || l.empClass === "STSO"; };

  var lockedTso = existingLockedLines.filter(isTsoLine);
  var lockedLtso = existingLockedLines.filter(isLtsoLine);
  var lockedStso = existingLockedLines.filter(isStsoLine);
  var lockedOther = existingLockedLines.filter(function (l) {
    return !isTsoLine(l) && !isLtsoLine(l) && !isStsoLine(l);
  });

  // Ensure locked lines refresh shift metadata
  existingLockedLines.forEach(function (l) {
    var sh = S.getShift ? S.getShift(l.shiftId) : null;
    if (sh) {
      l.shiftName = sh.name;
      l.shiftLabel = S.shiftLabel ? S.shiftLabel(sh) : ((sh.start || "") + "–" + (sh.end || ""));
      if (l.startTime !== undefined) l.startTime = sh.start;
      if (l.endTime !== undefined) l.endTime = sh.end;
      if (l.start !== undefined) l.start = sh.start;
      if (l.end !== undefined) l.end = sh.end;
    }
  });

  var tsoLines = [];
  var mode = "extras";
  var total = S.state.ftM + S.state.ftF + S.state.ptM + S.state.ptF;
  if (total > 0) {
    var allocation = S.allocateShiftHeadcounts(total, S.timeToMin(S.state.open), S.timeToMin(S.state.close));
    var counts = adjustCountsForLocked(allocation.counts, lockedTso, isTsoLine);
    mode = allocation.mode;
    tsoLines = S.buildLines(counts);
  }
  S.state.mode = mode;

  var ltsoTotal = Math.max(0, (S.state.ltsoM + S.state.ltsoF) - lockedLtso.length);
  var ltsoLines = [];
  var openMin = S.timeToMin(S.state.open);
  var closeMin = S.timeToMin(S.state.close);
  if (ltsoTotal > 0) {
    var ltsoAlloc = S.allocateSupervisoryHeadcounts(ltsoTotal, openMin, closeMin, "ltsoForce", tsoLines);
    ltsoLines = S.buildSupervisoryLines(ltsoAlloc.counts || {}, "LTSO");
  }
  var stsoTotal = Math.max(0, (S.state.stsoM + S.state.stsoF) - lockedStso.length);
  var stsoLines = [];
  if (stsoTotal > 0) {
    var stsoAlloc = S.allocateSupervisoryHeadcounts(stsoTotal, openMin, closeMin, "stsoForce", tsoLines);
    stsoLines = S.buildSupervisoryLines(stsoAlloc.counts || {}, "STSO");
  }
  var extraLines = S.buildExtraPositionLines ? S.buildExtraPositionLines() : [];
  var trainingLines = S.buildTrainingClassLines ? S.buildTrainingClassLines() : [];

  S.state.lines = [].concat(
    lockedTso, tsoLines,
    lockedLtso, ltsoLines,
    lockedStso, stsoLines,
    lockedOther, extraLines, trainingLines
  );
  applyPositionGender(S.state, S.state.lines);

  var days = S.state.weekCount * 7;
  S.state.schedule = {};
  S.state.lines.forEach(function (line) {
    S.state.schedule[line.id] = buildScheduleForLine(S, line, days);
  });

  if (S.readFunctionBandsFromDom) S.readFunctionBandsFromDom();
  var fcMode = S.getFunctionMode ? S.getFunctionMode() : "none";
  if (S.generateFunctionAssignments) {
    S.generateFunctionAssignments({ fromGenerate: true });
  } else if (S.clearLineFunctions) {
    S.clearLineFunctions();
  }
  if (S.assignCertPools) S.assignCertPools();

  formExtraTeams(S);
  if (S.renderTeams) {
    try { S.renderTeams(); } catch (e) {}
  }

  var dayTotals = [];
  var workingLines = S.state.lines.filter(function (l) {
    if (l.isLtso || l.isStso) return false;
    if (l.isExtra || l.extraPositionId) return !!l.opsFte;
    return true;
  });
  for (var d = 0; d < Math.min(7, days); d++) {
    dayTotals.push(workingLines.filter(function (l) {
      return S.state.schedule[l.id][d] === "WORK";
    }).length);
  }
  var dMin = Math.min.apply(null, dayTotals);
  var dMax = Math.max.apply(null, dayTotals);
  var extraHead = 0;
  ((S.state && S.state.extraPositions) || []).forEach(function (p) {
    extraHead += (+p.m || 0) + (+p.f || 0);
  });
  if (dMax - dMin > Math.max(2, Math.ceil(total * 0.15))) {
    S.state.issues.push("Day-of-week TSO headcount still varies " + dMin + "–" + dMax + " (RDO stagger). Prefer varied seeds are already applied.");
  }
  try {
    if (S.renderAll) S.renderAll();
    if (S.renderCoverageBars) S.renderCoverageBars();
    if (S.__USE_SVELTE_LINES) {
      window.dispatchEvent(new CustomEvent("lines:request-render"));
    } else if (S.renderLines) S.renderLines();
  } catch (err) {
    console.error("generate UI refresh", err);
  }
  if (S.updateStatus) {
    S.updateStatus(
      "Scheduled " + S.state.lines.length + " lines (FT " + S.state.ftM + "/" + S.state.ftF +
      " · PT " + S.state.ptM + "/" + S.state.ptF +
      " · LTSO " + S.state.ltsoM + "/" + S.state.ltsoF +
      " · STSO " + S.state.stsoM + "/" + S.state.stsoF +
      " · ESTI " + (S.state.esti || 0) +
      " · MSTI " + (S.state.msti || 0) +
      (extraHead ? " · other FTE " + extraHead : "") +
      genderStatusNote(S.state) +
      ") · " + mode + " · " + S.state.weekCount + " wk" +
      (fcMode && fcMode !== "none" ? " · " + String(fcMode).toUpperCase() + " duties" : "") +
      (S.state.issues.length ? " · " + S.state.issues.length + " note(s)" : "")
    );
  }
  notifySessionLines();
}

export function attachGenerate(S) {
  if (!S) return;
  S.buildScheduleForLine = function (line, days) {
    return buildScheduleForLine(S, line, days);
  };
  S._setupGenerate = function () { return generate(S); };
  S.generate = function () { return generate(S); };
}