// @ts-nocheck
/** Single-class roster generator. Rebuilds lines for one class while keeping
 *  all other classes' lines, shifts, RDOs, duties, and certs untouched.
 */
import { buildScheduleForLine } from "../actions/generate.js";
import { assignCertPoolsToLines } from "./certAssign.js";

export function belongsToClass(line, classKey) {
  if (!line) return false;
  if (classKey === "STSO") {
    return !!(line.isStso || line.empClass === "STSO" || line.position === "STSO");
  }
  if (classKey === "LTSO") {
    return !!(line.isLtso || line.empClass === "LTSO" || line.position === "LTSO");
  }
  if (classKey === "TSO") {
    var isStsoOrLtso = line.isStso || line.isLtso || line.empClass === "STSO" || line.empClass === "LTSO";
    var isExtraOrTraining = line.isExtra || line.extraPositionId || line.isTraining || line.trainingClass || line.empClass === "ESTI" || line.empClass === "MSTI";
    return !isStsoOrLtso && !isExtraOrTraining;
  }
  if (classKey === "MSTI") {
    return line.trainingClass === "MSTI" || line.empClass === "MSTI" || line.extraName === "MSTI";
  }
  if (classKey === "ESTI") {
    return line.trainingClass === "ESTI" || line.empClass === "ESTI" || line.extraName === "ESTI";
  }
  if (classKey.indexOf("EXTRA_") === 0) {
    var extraId = classKey.substring(6);
    return line.extraPositionId === extraId || String(line.extraPositionId) === extraId || line.extraName === extraId;
  }
  return false;
}

export function getClassHeadcount(S, classKey) {
  var st = (S && S.state) || {};
  if (classKey === "STSO") return { M: st.stsoM || 0, F: st.stsoF || 0, total: (st.stsoM || 0) + (st.stsoF || 0) };
  if (classKey === "LTSO") return { M: st.ltsoM || 0, F: st.ltsoF || 0, total: (st.ltsoM || 0) + (st.ltsoF || 0) };
  if (classKey === "TSO") {
    var m = (st.ftM || 0) + (st.ptM || 0);
    var f = (st.ftF || 0) + (st.ptF || 0);
    return { M: m, F: f, total: m + f };
  }
  if (classKey === "MSTI") return { M: 0, F: 0, total: st.msti || 0 };
  if (classKey === "ESTI") return { M: 0, F: 0, total: st.esti || 0 };
  if (classKey.indexOf("EXTRA_") === 0) {
    var extraId = classKey.substring(6);
    var list = st.extraPositions || [];
    var pos = list.find(function (p) { return p.id === extraId || p.name === extraId; });
    if (pos) return { M: +pos.m || 0, F: +pos.f || 0, total: (+pos.m || 0) + (+pos.f || 0) };
  }
  return { M: 0, F: 0, total: 0 };
}

function getNextId(existingIds, startId) {
  var id = startId;
  while (existingIds.has(id)) {
    id++;
  }
  existingIds.add(id);
  return id;
}

export function generateClass(S, classKey, perShiftTargets) {
  if (!S || !S.state) return;
  S.state.issues = S.state.issues || [];
  if (S.collectSetupInputs) S.collectSetupInputs();
  if (S.readShiftsFromDom) S.readShiftsFromDom();

  var openMin = S.timeToMin ? S.timeToMin(S.state.open) : 210;
  var closeMin = S.timeToMin ? S.timeToMin(S.state.close) : 1380;
  var days = (S.state.weekCount || 1) * 7;
  var existingLines = S.state.lines || [];
  var existingSchedule = S.state.schedule || {};
  var existingRotation = S.state.functionRotation || {};

  // Separate untouched lines from lines belonging to classKey
  var untouchedLines = [];
  var lockedClassLines = [];

  existingLines.forEach(function (l) {
    if (!belongsToClass(l, classKey)) {
      untouchedLines.push(l);
    } else if (S.isLineScheduleLocked && S.isLineScheduleLocked(l)) {
      lockedClassLines.push(l);
    }
  });

  // Collect existing line IDs
  var usedIds = new Set();
  untouchedLines.forEach(function (l) { usedIds.add(+l.id); });
  lockedClassLines.forEach(function (l) { usedIds.add(+l.id); });

  // Save snapshot of untouched line schedule & functionRotation
  var savedSchedule = {};
  var savedRotation = {};
  untouchedLines.concat(lockedClassLines).forEach(function (l) {
    if (existingSchedule[l.id]) savedSchedule[l.id] = existingSchedule[l.id].slice();
    if (existingRotation[l.id]) savedRotation[l.id] = existingRotation[l.id].slice();
  });

  var newClassLines = [];
  var hc = getClassHeadcount(S, classKey);
  var shifts = S.state.shifts || [];
  var fallbackShift = shifts[0] || { id: "S1", name: "AM", start: "03:30", end: "12:00", paid: 8 };

  // Calculate locked counts by sex, shift, and PT/FT
  var lockedM = 0, lockedF = 0;
  var lockedFtM = 0, lockedFtF = 0, lockedPtM = 0, lockedPtF = 0;
  var lockedShiftM = {};
  var lockedShiftF = {};

  shifts.forEach(function (s) {
    lockedShiftM[s.id] = 0;
    lockedShiftF[s.id] = 0;
  });

  lockedClassLines.forEach(function (l) {
    var isF = l.sex === "F";
    var isPt = l.empClass === "PT";
    if (isF) {
      lockedF++;
      if (isPt) lockedPtF++; else lockedFtF++;
      if (l.shiftId && lockedShiftF[l.shiftId] != null) lockedShiftF[l.shiftId]++;
    } else {
      lockedM++;
      if (isPt) lockedPtM++; else lockedFtM++;
      if (l.shiftId && lockedShiftM[l.shiftId] != null) lockedShiftM[l.shiftId]++;
    }
  });

  var startId = 1;
  if (classKey === "STSO") startId = 10000;
  else if (classKey === "LTSO") startId = 20000;
  else if (classKey === "TSO") startId = 1;
  else if (classKey === "MSTI") startId = 40000;
  else if (classKey === "ESTI") startId = 41000;
  else if (classKey.indexOf("EXTRA_") === 0) startId = 30000;

  if (perShiftTargets && typeof perShiftTargets === "object") {
    // Generate class using perShiftTargets, taking locked lines into account
    var isTrainCls = classKey === "MSTI" || classKey === "ESTI";

    var maxNewM = isTrainCls ? Math.max(0, hc.total - lockedClassLines.length) : Math.max(0, hc.M - lockedM);
    var maxNewF = isTrainCls ? 0 : Math.max(0, hc.F - lockedF);

    var remMaxNewM = maxNewM;
    var remMaxNewF = maxNewF;

    var totalTargetedM = lockedM;
    var totalTargetedF = lockedF;

    var remPtM = classKey === "TSO" ? Math.max(0, (+S.state.ptM || 0) - lockedPtM) : 0;
    var remPtF = classKey === "TSO" ? Math.max(0, (+S.state.ptF || 0) - lockedPtF) : 0;

    shifts.forEach(function (sh) {
      var t = perShiftTargets[sh.id] || { M: 0, F: 0 };
      var tM = Math.max(0, +t.M || 0);
      var tF = Math.max(0, +t.F || 0);

      var lM = lockedShiftM[sh.id] || 0;
      var lF = lockedShiftF[sh.id] || 0;

      var needM = Math.max(0, tM - lM);
      var needF = Math.max(0, tF - lF);

      if (isTrainCls) {
        needM = Math.min(needM, remMaxNewM);
        remMaxNewM -= needM;
        totalTargetedM += needM;
      } else {
        needM = Math.min(needM, remMaxNewM);
        remMaxNewM -= needM;
        totalTargetedM += needM;

        needF = Math.min(needF, remMaxNewF);
        remMaxNewF -= needF;
        totalTargetedF += needF;
      }

      for (var i = 0; i < needM; i++) {
        var idM = getNextId(usedIds, startId);
        var isPtM = remPtM > 0;
        if (isPtM) remPtM--;
        newClassLines.push(createLineForClass(S, classKey, idM, sh, isTrainCls ? "" : "M", false, isPtM));
      }
      for (var j = 0; j < needF; j++) {
        var idF = getNextId(usedIds, startId);
        var isPtF = remPtF > 0;
        if (isPtF) remPtF--;
        newClassLines.push(createLineForClass(S, classKey, idF, sh, "F", false, isPtF));
      }
    });

    // Handle shortfalls if total targeted < entered headcount
    if (isTrainCls) {
      var totalTrainLines = lockedClassLines.length + (maxNewM - remMaxNewM);
      var shortfallTrain = Math.max(0, hc.total - totalTrainLines);
      for (var st = 0; st < shortfallTrain; st++) {
        var sfId = getNextId(usedIds, startId);
        newClassLines.push(createLineForClass(S, classKey, sfId, fallbackShift, "", false, false));
      }
    } else {
      var shortfallM = Math.max(0, hc.M - totalTargetedM);
      var shortfallF = Math.max(0, hc.F - totalTargetedF);

      for (var sm = 0; sm < shortfallM; sm++) {
        var sfIdM = getNextId(usedIds, startId);
        var isPtSfM = remPtM > 0;
        if (isPtSfM) remPtM--;
        var lineSfM = createLineForClass(S, classKey, sfIdM, fallbackShift, "M", true, isPtSfM);
        newClassLines.push(lineSfM);
      }
      for (var sf = 0; sf < shortfallF; sf++) {
        var sfIdF = getNextId(usedIds, startId);
        var isPtSfF = remPtF > 0;
        if (isPtSfF) remPtF--;
        var lineSfF = createLineForClass(S, classKey, sfIdF, fallbackShift, "F", true, isPtSfF);
        newClassLines.push(lineSfF);
      }
    }
  } else {
    // Standard generation for this class
    var allExisting = untouchedLines.concat(lockedClassLines);
    if (classKey === "STSO") {
      var remStsoM = Math.max(0, (S.state.stsoM || 0) - lockedM);
      var remStsoF = Math.max(0, (S.state.stsoF || 0) - lockedF);
      var stsoTotal = remStsoM + remStsoF;
      if (stsoTotal > 0) {
        var origStsoM = S.state.stsoM, origStsoF = S.state.stsoF;
        S.state.stsoM = remStsoM; S.state.stsoF = remStsoF;
        var stsoAlloc = S.allocateSupervisoryHeadcounts(stsoTotal, openMin, closeMin, "stsoForce", allExisting);
        newClassLines = S.buildSupervisoryLines(stsoAlloc.counts || {}, "STSO");
        S.state.stsoM = origStsoM; S.state.stsoF = origStsoF;
      }
    } else if (classKey === "LTSO") {
      var remLtsoM = Math.max(0, (S.state.ltsoM || 0) - lockedM);
      var remLtsoF = Math.max(0, (S.state.ltsoF || 0) - lockedF);
      var ltsoTotal = remLtsoM + remLtsoF;
      if (ltsoTotal > 0) {
        var origLtsoM = S.state.ltsoM, origLtsoF = S.state.ltsoF;
        S.state.ltsoM = remLtsoM; S.state.ltsoF = remLtsoF;
        var ltsoAlloc = S.allocateSupervisoryHeadcounts(ltsoTotal, openMin, closeMin, "ltsoForce", allExisting);
        newClassLines = S.buildSupervisoryLines(ltsoAlloc.counts || {}, "LTSO");
        S.state.ltsoM = origLtsoM; S.state.ltsoF = origLtsoF;
      }
    } else if (classKey === "TSO") {
      var remFtM = Math.max(0, (S.state.ftM || 0) - lockedFtM);
      var remFtF = Math.max(0, (S.state.ftF || 0) - lockedFtF);
      var remPtM2 = Math.max(0, (S.state.ptM || 0) - lockedPtM);
      var remPtF2 = Math.max(0, (S.state.ptF || 0) - lockedPtF);
      var tsoTotal = remFtM + remFtF + remPtM2 + remPtF2;
      if (tsoTotal > 0) {
        var oFtM = S.state.ftM, oFtF = S.state.ftF, oPtM = S.state.ptM, oPtF = S.state.ptF;
        S.state.ftM = remFtM; S.state.ftF = remFtF; S.state.ptM = remPtM2; S.state.ptF = remPtF2;
        var allocation = S.allocateShiftHeadcounts(tsoTotal, openMin, closeMin);
        newClassLines = S.buildLines(allocation.counts || {});
        S.state.ftM = oFtM; S.state.ftF = oFtF; S.state.ptM = oPtM; S.state.ptF = oPtF;
      }
    } else if (classKey === "ESTI" || classKey === "MSTI") {
      var remTrainTotal = Math.max(0, hc.total - lockedClassLines.length);
      if (remTrainTotal > 0) {
        var oEsti = S.state.esti, oMsti = S.state.msti;
        if (classKey === "ESTI") S.state.esti = remTrainTotal;
        else S.state.msti = remTrainTotal;
        var trainLines = S.buildTrainingClassLines ? S.buildTrainingClassLines() : [];
        newClassLines = trainLines.filter(function (l) { return belongsToClass(l, classKey); });
        S.state.esti = oEsti; S.state.msti = oMsti;
      }
    } else if (classKey.indexOf("EXTRA_") === 0) {
      var extraId = classKey.substring(6);
      var extraList = (S.state && S.state.extraPositions) || [];
      var pos = extraList.find(function (p) { return p.id === extraId || p.name === extraId; });
      if (pos) {
        var remExtraM = Math.max(0, (+pos.m || 0) - lockedM);
        var remExtraF = Math.max(0, (+pos.f || 0) - lockedF);
        if (remExtraM + remExtraF > 0) {
          var oM = pos.m, oF = pos.f;
          pos.m = remExtraM; pos.f = remExtraF;
          var extraLines = S.buildExtraPositionLines ? S.buildExtraPositionLines() : [];
          newClassLines = extraLines.filter(function (l) { return belongsToClass(l, classKey); });
          pos.m = oM; pos.f = oF;
        }
      }
    }

    // Re-assign IDs for new lines if they clash with usedIds and record kept IDs
    newClassLines.forEach(function (line) {
      if (usedIds.has(+line.id)) {
        var newId = getNextId(usedIds, startId);
        line.id = newId;
        var prefix = line.position || classKey;
        line.lineCode = prefix + " " + String(newId).padStart(3, "0");
      } else {
        usedIds.add(+line.id);
      }
    });
  }

  // Combine updated lines
  S.state.lines = untouchedLines.concat(lockedClassLines, newClassLines);

  // Rebuild schedule for new class lines only
  newClassLines.forEach(function (line) {
    S.state.schedule[line.id] = buildScheduleForLine(S, line, days);
  });

  // Restore untouched & locked line schedules
  Object.keys(savedSchedule).forEach(function (lineId) {
    S.state.schedule[lineId] = savedSchedule[lineId];
  });

  // Setup function rotation & duties
  S.state.functionRotation = S.state.functionRotation || {};
  Object.keys(savedRotation).forEach(function (lineId) {
    S.state.functionRotation[lineId] = savedRotation[lineId];
  });

  // Populate duties for new class lines
  newClassLines.forEach(function (line) {
    var rot = [];
    var sched = S.state.schedule[line.id] || [];
    var isTrain = line.isTraining || line.trainingClass || line.empClass === "ESTI" || line.empClass === "MSTI";

    if (line.isShortfall || line.function === "-") {
      line.function = "-";
      for (var d = 0; d < days; d++) {
        rot[d] = sched[d] === "WORK" ? "-" : "OFF";
      }
    } else if (isTrain) {
      line.function = "TRAINING";
      for (var dt = 0; dt < days; dt++) {
        rot[dt] = sched[dt] === "WORK" ? "TRAINING" : "OFF";
      }
    } else {
      line.function = line.function || "PAX";
      for (var dp = 0; dp < days; dp++) {
        rot[dp] = sched[dp] === "WORK" ? (line.function || "PAX") : "OFF";
      }
    }
    S.state.functionRotation[line.id] = rot;
  });

  // Assign cert pools for non-shortfall new lines without overwriting untouched lines
  var assignableNewLines = newClassLines.filter(function (l) {
    return !l.isShortfall && l.function !== "-";
  });

  // Shortfall lines explicitly get certPool A (non-DFO)
  newClassLines.forEach(function (l) {
    if (l.isShortfall || l.function === "-") {
      l.certPool = "A";
      if (l.functionEligible) { l.functionEligible.dfo = false; l.functionEligible.pax = false; }
    }
  });

  if (S.assignCertPoolsToLines && assignableNewLines.length) {
    assignCertPoolsToLines(assignableNewLines, S.state.certPool, {
      startMinOf: function (line) {
        if (S.getShift && S.timeToMin) {
          var sh = S.getShift(line.shiftId);
          return sh ? S.timeToMin(sh.start) : 0;
        }
        return 0;
      },
      getShift: S.getShift,
      timeToMin: S.timeToMin,
      schedule: S.state.schedule || {},
      openMin: openMin,
      closeMin: closeMin
    });
  }

  // Refresh UI
  try {
    if (S.renderAll) S.renderAll();
    if (S.renderCoverageBars) S.renderCoverageBars();
    if (S.__USE_SVELTE_LINES && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("lines:request-render"));
    } else if (S.renderLines) S.renderLines();
  } catch (err) {
    console.error("generateClass UI refresh", err);
  }

  if (S.updateStatus) {
    S.updateStatus("Generated " + classKey + " (" + newClassLines.length + " lines). Other classes untouched.");
  }
}

function createLineForClass(S, classKey, id, shift, sex, isShortfall, isPt) {
  var isStso = classKey === "STSO";
  var isLtso = classKey === "LTSO";
  var isTrain = classKey === "MSTI" || classKey === "ESTI";
  var isExtra = classKey.indexOf("EXTRA_") === 0;

  var empClass = isStso ? "STSO" : (isLtso ? "LTSO" : (isTrain ? classKey : (isPt ? "PT" : "FT")));
  var position = isStso ? "STSO" : (isLtso ? "LTSO" : (isTrain ? classKey : "TSO"));
  var ptHours = S && S.state ? Number(S.state.ptHoursPerDay) : NaN;
  var ptPaid = Number.isFinite(ptHours) && ptHours > 0 ? Math.min(12, ptHours) : 4;
  var linePaid = isPt ? ptPaid : (shift.paid || 8);

  var lineCode = position + " " + String(id).padStart(3, "0");
  var opsFte = false;
  if (isExtra) {
    var extraId = classKey.substring(6);
    position = extraId;
    lineCode = extraId + " " + String(id).padStart(3, "0");
    var extraList = (S && S.state && S.state.extraPositions) || [];
    var posDef = extraList.find(function (p) { return p.id === extraId || p.name === extraId; });
    if (posDef) {
      if (S && S.opsFteYes) opsFte = S.opsFteYes(posDef);
      else opsFte = String(posDef.opsFte).toLowerCase() === "yes" || posDef.opsFte === true || posDef.opsFte === 1;
      if (posDef.name) position = posDef.name;
    }
  }

  var workDays = S.targetWorkDays ? S.targetWorkDays(shift.id, empClass) : ((+shift.paid || 8) >= 10 ? 4 : 5);
  var rdoCount = 7 - workDays;
  var hard = Array.isArray(shift.rdoHard)
    ? shift.rdoHard.map(Number).filter(function (x) { return x >= 0 && x <= 6; })
    : [];
  var rdoDays = hard.length > 0 ? hard.slice() : (S.consecutiveRdos ? S.consecutiveRdos(rdoCount, id % 7) : [0, 6]);
  while (rdoDays.length < rdoCount) {
    for (var d = 0; d < 7 && rdoDays.length < rdoCount; d++) {
      if (rdoDays.indexOf(d) < 0) rdoDays.push(d);
    }
  }

  return {
    id: id,
    lineCode: lineCode,
    shiftId: shift.id,
    shiftName: shift.name,
    shiftLabel: S.shiftLabel ? S.shiftLabel(shift) : ((shift.start || "") + "–" + (shift.end || "")),
    empClass: empClass,
    position: position,
    isStso: isStso,
    isLtso: isLtso,
    isExtra: isExtra,
    isTraining: isTrain,
    trainingClass: isTrain ? classKey : null,
    extraPositionId: isExtra ? classKey.substring(6) : null,
    extraName: isExtra ? classKey.substring(6) : null,
    opsFte: opsFte,
    sex: isTrain ? "" : sex,
    function: isShortfall ? "-" : (isTrain ? "TRAINING" : "PAX"),
    isShortfall: !!isShortfall,
    rdoDays: rdoDays,
    rdoHard: hard.length > 0,
    paid: linePaid
  };
}

export function attachClassGenerate(S) {
  if (!S) return;
  S.belongsToClass = belongsToClass;
  S.getClassHeadcount = function (classKey) { return getClassHeadcount(S, classKey); };
  S.generateClass = function (classKey, perShiftTargets) { return generateClass(S, classKey, perShiftTargets); };
}
