/** DFO Cert Balance & Baggage Day Reshuffle Engine.
 *  Handles same-sex DFO cert moves when shift cert counts differ (lines never move),
 *  or baggage day reshuffles when shift cert counts match.
 *  Blank sex (gender ignored) is not coerced to male.
 */
import { notifySessionLines } from "../sessionBus.js";

function sexKey(line) {
  if (!line) return "";
  if (line.sex === "M" || line.sex === "F") return line.sex;
  return "";
}

export function getDfoCertLinesForClass(S, classKey) {
  var lines = (S && S.state && S.state.lines) || [];
  return lines.filter(function (l) {
    if (!l) return false;
    var isExtra = !!(l.isExtra || l.extraPositionId);
    var isTraining = !!(l.isTraining || l.trainingClass || l.empClass === "ESTI" || l.empClass === "MSTI");
    if (isExtra || isTraining) return false;

    if (classKey === "STSO") return l.isStso || l.empClass === "STSO" || l.position === "STSO";
    if (classKey === "LTSO") return l.isLtso || l.empClass === "LTSO" || l.position === "LTSO";
    if (classKey === "TSO") return !l.isStso && !l.isLtso && l.empClass !== "STSO" && l.empClass !== "LTSO";
    return S.belongsToClass ? S.belongsToClass(l, classKey) : true;
  });
}

export function hasDfoCert(line) {
  if (!line) return false;
  if (line.certPool === "B" || line.function === "DFO") return true;
  return false;
}

export function proposeDfoCertBalance(S, classKey) {
  if (!S || !S.state) return { mode: "none", proposals: [], summary: "No Scheduler state" };

  var lines = getDfoCertLinesForClass(S, classKey);
  var shifts = S.state.shifts || [];

  if (!lines.length || !shifts.length) {
    return { mode: "none", proposals: [], summary: "No lines or shifts found for class " + classKey };
  }

  // Count DFO certs per shift for this class
  var shiftCertCounts = {};
  var shiftTotalLines = {};
  shifts.forEach(function (s) {
    shiftCertCounts[s.id] = 0;
    shiftTotalLines[s.id] = 0;
  });

  lines.forEach(function (l) {
    if (!l.shiftId || shiftCertCounts[l.shiftId] == null) return;
    shiftTotalLines[l.shiftId]++;
    if (hasDfoCert(l)) {
      shiftCertCounts[l.shiftId]++;
    }
  });

  // Check if active shifts with lines have differing DFO cert counts
  var activeShifts = shifts.filter(function (s) { return shiftTotalLines[s.id] > 0; });
  if (!activeShifts.length) {
    return { mode: "none", proposals: [], summary: "No active lines on shifts for class " + classKey };
  }

  var certCountsList = activeShifts.map(function (s) { return shiftCertCounts[s.id]; });
  var minCerts = Math.min.apply(null, certCountsList);
  var maxCerts = Math.max.apply(null, certCountsList);

  var certsMatch = minCerts === maxCerts;

  if (certsMatch) {
    // Branch B: Cert counts already match! Propose baggage day reshuffle
    return {
      mode: "baggage_reshuffle",
      certsMatch: true,
      certCountPerShift: minCerts,
      proposals: [],
      summary: "DFO cert counts already match across shifts (" + minCerts + " certs/shift). Proposed fix: Reshuffle baggage duty days."
    };
  }

  // Branch A: Cert counts differ! Propose moving DFO certs between same-sex people across shifts (lines stay put)
  var avgCerts = Math.round(certCountsList.reduce(function (a, b) { return a + b; }, 0) / certCountsList.length);
  var donorShifts = activeShifts.filter(function (s) { return shiftCertCounts[s.id] > avgCerts; });
  var receiverShifts = activeShifts.filter(function (s) { return shiftCertCounts[s.id] < avgCerts; });

  var workingCertCounts = Object.assign({}, shiftCertCounts);
  var proposals = [];
  var usedReceiverIds = new Set();

  donorShifts.forEach(function (dShift) {
    var surplus = workingCertCounts[dShift.id] - avgCerts;
    var donorCertLines = lines.filter(function (l) {
      return l.shiftId === dShift.id && hasDfoCert(l) && !(S.isLineScheduleLocked && S.isLineScheduleLocked(l));
    });

    for (var dIdx = 0; dIdx < donorCertLines.length && surplus > 0; dIdx++) {
      var candDonor = donorCertLines[dIdx];
      var candSex = sexKey(candDonor);

      var matchedRecv = null;
      var matchedRShift = null;

      var availRecvShifts = receiverShifts.filter(function (rs) { return workingCertCounts[rs.id] < avgCerts; });

      // Check all available receiver shifts for a same-sex receiver line
      for (var rIdx = 0; rIdx < availRecvShifts.length; rIdx++) {
        var candRShift = availRecvShifts[rIdx];
        var candRecv = lines.find(function (l) {
          return l.shiftId === candRShift.id && sexKey(l) === candSex && !hasDfoCert(l) && !usedReceiverIds.has(l.id) && !(S.isLineScheduleLocked && S.isLineScheduleLocked(l));
        });
        if (candRecv) {
          matchedRecv = candRecv;
          matchedRShift = candRShift;
          break;
        }
      }

      if (!matchedRecv || !matchedRShift) {
        continue;
      }

      usedReceiverIds.add(matchedRecv.id);

      proposals.push({
        donorLine: candDonor,
        receiverLine: matchedRecv,
        sex: candSex,
        donorShift: dShift,
        receiverShift: matchedRShift,
        note: "Move DFO cert from " + (candDonor.lineCode || candDonor.id) + " (" + dShift.name + ") to " + (matchedRecv.lineCode || matchedRecv.id) + " (" + matchedRShift.name + "). Lines do not move."
      });

      workingCertCounts[dShift.id]--;
      workingCertCounts[matchedRShift.id]++;
      surplus--;
    }
  });

  var summaryMsg = "DFO cert counts differ between shifts (" + minCerts + " to " + maxCerts + "). Proposed fix: Move DFO certs between same-sex lines across shifts (lines stay on original shifts).";

  return {
    mode: "cert_move",
    certsMatch: false,
    proposals: proposals,
    summary: summaryMsg
  };
}

export function approveDfoCertBalance(S, propResult, selectedProposals) {
  if (!S || !S.state || !propResult) return false;

  if (propResult.mode === "baggage_reshuffle") {
    // Run baggage day reshuffle
    if (S.readFunctionCoverageFromDom) S.readFunctionCoverageFromDom();
    var fc = S.ensureFunctionCoverage ? S.ensureFunctionCoverage() : S.state.functionCoverage;
    var days = (S.state.weekCount || 1) * 7;
    if (S.resolveBagDuties) {
      S.resolveBagDuties(fc, days);
    } else {
      notifySessionLines();
    }
    if (S.updateStatus) S.updateStatus("Approved baggage day reshuffle.");
    return true;
  }

  if (propResult.mode === "cert_move") {
    var props = Array.isArray(selectedProposals) && selectedProposals.length ? selectedProposals : propResult.proposals;
    if (!props || !props.length) return false;

    var lines = S.state.lines || [];
    var count = 0;

    props.forEach(function (p) {
      var dLine = lines.find(function (l) { return String(l.id) === String(p.donorLine.id); });
      var rLine = lines.find(function (l) { return String(l.id) === String(p.receiverLine.id); });
      if (!dLine || !rLine) return;

      // Refuse pair if sexes differ
      if (sexKey(dLine) !== sexKey(rLine)) {
        if (S.state && S.state.issues) S.state.issues.push("Refused DFO cert move between different sexes (" + dLine.sex + " vs " + rLine.sex + ")");
        return;
      }

      var dShiftOriginal = dLine.shiftId;
      var rShiftOriginal = rLine.shiftId;

      // Swap DFO cert status between dLine and rLine (SAME SEX, SHIFTS DO NOT MOVE)
      dLine.certPool = "A";
      dLine.function = "PAX";
      if (dLine.functionEligible) { dLine.functionEligible.dfo = false; dLine.functionEligible.pax = true; }

      rLine.certPool = "B";
      rLine.function = "DFO";
      if (rLine.functionEligible) { rLine.functionEligible.dfo = true; rLine.functionEligible.pax = false; }

      // Confirm shiftId is unchanged
      dLine.shiftId = dShiftOriginal;
      rLine.shiftId = rShiftOriginal;

      count++;
    });

    if (count > 0) {
      // Re-run baggage day rotation
      if (S.resolveBagDuties) {
        var fc2 = S.ensureFunctionCoverage ? S.ensureFunctionCoverage() : S.state.functionCoverage;
        var days2 = (S.state.weekCount || 1) * 7;
        S.resolveBagDuties(fc2, days2);
      }
      notifySessionLines();
      if (S.updateStatus) S.updateStatus("Approved " + count + " same-sex DFO cert move(s). Lines remained in place.");
      if (S.renderAll) S.renderAll();
      if (S.__USE_SVELTE_LINES && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("lines:request-render"));
      } else if (S.renderLines) S.renderLines();
      return true;
    }
  }

  return false;
}

export function attachDfoCertBalance(S) {
  if (!S) return;
  S.proposeDfoCertBalance = function (classKey) { return proposeDfoCertBalance(S, classKey); };
  S.approveDfoCertBalance = function (propResult, selectedProposals) { return approveDfoCertBalance(S, propResult, selectedProposals); };
}
