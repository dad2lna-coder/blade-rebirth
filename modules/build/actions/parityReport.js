/** RDO Parity (Fairness) Report and Swap Proposal Engine.
 *  Identifies sex imbalances across RDO patterns on shifts/bands and proposes
 *  swapping RDO patterns between lines of different sexes without changing shift or sex.
 *  Non-count and gender-ignored lines stay out of the count (rebirth gender policy).
 */
import { getBandKey } from "../fte/buildLines.js";
import { classIgnoresGender, countedSex } from "../fte/gender.js";
import { notifySessionLines } from "../sessionBus.js";

var DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function formatRdos(rdoDays) {
  if (!Array.isArray(rdoDays) || !rdoDays.length) return "None";
  var sorted = rdoDays.slice().map(Number).sort(function (a, b) { return a - b; });
  return sorted.map(function (d) { return DAYS_SHORT[d] || d; }).join("-");
}

export function getBandLabel(S, bandKey) {
  if (String(bandKey).indexOf("crew_") === 0) {
    var cgId = String(bandKey).substring(5);
    var groups = (S && S.state && S.state.shiftCrewGroups) || [];
    var grp = groups.find(function (item) { return item.id === cgId; });
    if (grp) return "Group: " + (grp.name || grp.id);
  }
  var shifts = (S && S.state && S.state.shifts) || [];
  var shift = shifts.find(function (item) { return item.id === bandKey; });
  if (shift) return (shift.name || shift.id) + (shift.start ? " (" + shift.start + "–" + shift.end + ")" : "");
  return bandKey;
}

function sexOf(line) {
  return countedSex(line);
}

export function getParityLinesForClass(S, classKey) {
  var lines = (S && S.state && S.state.lines) || [];
  return lines.filter(function (l) {
    return S.belongsToClass ? S.belongsToClass(l, classKey) : false;
  });
}

export function rdoPatternKey(rdoDays) {
  if (!Array.isArray(rdoDays) || !rdoDays.length) return "none";
  return rdoDays.slice().map(Number).sort(function (a, b) { return a - b; }).join("-");
}

function isWeekendPattern(rdoDays) {
  if (!Array.isArray(rdoDays)) return false;
  return rdoDays.indexOf(0) >= 0 || rdoDays.indexOf(6) >= 0;
}

function getShiftLabel(S, shiftId) {
  var shifts = (S && S.state && S.state.shifts) || [];
  var sh = shifts.find(function (s) { return s.id === shiftId; });
  return sh ? (sh.name || sh.id) : shiftId;
}

export function checkParity(S, classKey, selectedBandKeys) {
  if (!S || !S.state) return { disparities: [], proposals: [], summary: "No Scheduler state" };

  if (classKey === "STSO") {
    return {
      disparities: [],
      proposals: [],
      summary: "STSO parity check not applicable under half-day RDO parity rules (LTSO & TSO only)."
    };
  }

  if (classIgnoresGender(S.state, classKey)) {
    return {
      disparities: [],
      proposals: [],
      summary: "Class " + classKey + " parity check skipped — gender is ignored for this class."
    };
  }

  var lines = getParityLinesForClass(S, classKey);
  if (!lines.length) {
    return { disparities: [], proposals: [], summary: "No lines found for class " + classKey };
  }

  // Filter lines by selected bands
  var bandSet = new Set(Array.isArray(selectedBandKeys) && selectedBandKeys.length ? selectedBandKeys : []);
  var targetLines = lines.filter(function (l) {
    if (!l.shiftId) return false;
    if (l.isShortfall || l.function === "-") return false;
    var bk = getBandKey(S, l.shiftId);
    return bandSet.size === 0 || bandSet.has(bk);
  });

  if (!targetLines.length) {
    return { disparities: [], proposals: [], summary: "No active lines match the selected bands." };
  }

  // Find all unique weekend RDO patterns across this class (Midweek patterns are ignored in this pass)
  var patternMap = {};
  targetLines.forEach(function (l) {
    if (isWeekendPattern(l.rdoDays)) {
      var pk = rdoPatternKey(l.rdoDays);
      if (!patternMap[pk]) {
        patternMap[pk] = {
          patternKey: pk,
          rdoDays: (l.rdoDays || []).slice()
        };
      }
    }
  });

  var weekendPatterns = Object.keys(patternMap).map(function (k) { return patternMap[k]; });

  // Get active shifts in targetLines
  var shiftIds = [];
  var seenShifts = {};
  targetLines.forEach(function (l) {
    if (l.shiftId && !seenShifts[l.shiftId]) {
      seenShifts[l.shiftId] = true;
      shiftIds.push(l.shiftId);
    }
  });

  var proposals = [];
  var disparities = [];
  var shortfalls = [];
  var pairedLineIds = new Set();

  shiftIds.forEach(function (shId) {
    var shLines = targetLines.filter(function (l) {
      return l.shiftId === shId && !(S.isLineScheduleLocked && S.isLineScheduleLocked(l));
    });

    var shLabel = getShiftLabel(S, shId);

    var linePattern = {};
    shLines.forEach(function (l) {
      linePattern[l.id] = rdoPatternKey(l.rdoDays);
    });

    var maxPasses = 10;
    var pass = 0;
    while (pass < maxPasses) {
      pass++;
      var madeProgress = false;

      var counts = {};
      shLines.forEach(function (l) {
        var pk = linePattern[l.id];
        if (!counts[pk]) counts[pk] = { M: 0, F: 0 };
        if (sexOf(l) === "M") counts[pk].M++;
        else if (sexOf(l) === "F") counts[pk].F++;
      });

      // 1. Try 1-for-1 swap between two weekend patterns on this shift where P1 has male surplus (cM >= 2) and P2 has female surplus (cF >= 2)
      var wPatterns = weekendPatterns.slice();
      for (var i = 0; i < wPatterns.length; i++) {
        var p1 = wPatterns[i];
        var pk1 = p1.patternKey;
        var c1 = counts[pk1] || { M: 0, F: 0 };

        if (c1.M > c1.F && c1.M >= 2) {
          for (var j = 0; j < wPatterns.length; j++) {
            if (i === j) continue;
            var p2 = wPatterns[j];
            var pk2 = p2.patternKey;
            var c2 = counts[pk2] || { M: 0, F: 0 };

            if (c2.F > c2.M && c2.F >= 2) {
              var donorM = shLines.find(function (l) {
                return sexOf(l) === "M" && linePattern[l.id] === pk1 && !pairedLineIds.has(l.id);
              });
              var donorF = shLines.find(function (l) {
                return sexOf(l) === "F" && linePattern[l.id] === pk2 && !pairedLineIds.has(l.id);
              });

              if (donorM && donorF) {
                pairedLineIds.add(donorM.id);
                pairedLineIds.add(donorF.id);

                linePattern[donorM.id] = pk2;
                linePattern[donorF.id] = pk1;

                var p1Label = formatRdos(p1.rdoDays);
                var p2Label = formatRdos(p2.rdoDays);

                proposals.push({
                  lineA: donorF,
                  lineB: donorM,
                  shiftId: shId,
                  rdoA_before: donorF.rdoDays,
                  rdoB_before: donorM.rdoDays,
                  rdoA_after: p1.rdoDays,
                  rdoB_after: p2.rdoDays,
                  note: shLabel + " shift: Swap RDOs so " + (donorF.lineCode || donorF.id) + " (F) gains pattern " + p1Label + " & " + (donorM.lineCode || donorM.id) + " (M) gains pattern " + p2Label
                });

                madeProgress = true;
                break;
              }
            }
          }
          if (madeProgress) break;
        }
      }

      if (madeProgress) continue;

      // 2. Try 1-for-1 swap between a weekend pattern with male/female surplus and a non-weekend pattern
      for (var i = 0; i < wPatterns.length; i++) {
        var p1 = wPatterns[i];
        var pk1 = p1.patternKey;
        var c1 = counts[pk1] || { M: 0, F: 0 };

        if (c1.M > c1.F && c1.M >= 2) {
          var donorM = shLines.find(function (l) {
            return sexOf(l) === "M" && linePattern[l.id] === pk1 && !pairedLineIds.has(l.id);
          });
          var donorF = shLines.find(function (l) {
            return sexOf(l) === "F" && linePattern[l.id] !== pk1 && !isWeekendPattern(l.rdoDays) && !pairedLineIds.has(l.id);
          });

          if (donorM && donorF) {
            var pkOther = linePattern[donorF.id];
            pairedLineIds.add(donorM.id);
            pairedLineIds.add(donorF.id);

            linePattern[donorM.id] = pkOther;
            linePattern[donorF.id] = pk1;

            var p1Label = formatRdos(p1.rdoDays);
            var pOtherLabel = formatRdos(donorF.rdoDays);

            proposals.push({
              lineA: donorF,
              lineB: donorM,
              shiftId: shId,
              rdoA_before: donorF.rdoDays,
              rdoB_before: donorM.rdoDays,
              rdoA_after: p1.rdoDays,
              rdoB_after: donorF.rdoDays,
              note: shLabel + " shift: Swap RDOs so " + (donorF.lineCode || donorF.id) + " (F) gains pattern " + p1Label + " & " + (donorM.lineCode || donorM.id) + " (M) gains pattern " + pOtherLabel
            });

            madeProgress = true;
            break;
          }
        } else if (c1.F > c1.M && c1.F >= 2) {
          var donorF = shLines.find(function (l) {
            return sexOf(l) === "F" && linePattern[l.id] === pk1 && !pairedLineIds.has(l.id);
          });
          var donorM = shLines.find(function (l) {
            return sexOf(l) === "M" && linePattern[l.id] !== pk1 && !isWeekendPattern(l.rdoDays) && !pairedLineIds.has(l.id);
          });

          if (donorM && donorF) {
            var pkOther = linePattern[donorM.id];
            pairedLineIds.add(donorM.id);
            pairedLineIds.add(donorF.id);

            linePattern[donorM.id] = pk1;
            linePattern[donorF.id] = pkOther;

            var p1Label = formatRdos(p1.rdoDays);
            var pOtherLabel = formatRdos(donorM.rdoDays);

            proposals.push({
              lineA: donorF,
              lineB: donorM,
              shiftId: shId,
              rdoA_before: donorF.rdoDays,
              rdoB_before: donorM.rdoDays,
              rdoA_after: donorM.rdoDays,
              rdoB_after: p1.rdoDays,
              note: shLabel + " shift: Swap RDOs so " + (donorM.lineCode || donorM.id) + " (M) gains pattern " + p1Label + " & " + (donorF.lineCode || donorF.id) + " (F) gains pattern " + pOtherLabel
            });

            madeProgress = true;
            break;
          }
        }
      }

      if (madeProgress) continue;

      // 3. For an empty weekend pattern (cM == 0 and cF == 0), assign 1 M and 1 F from available lines on non-weekend patterns
      for (var i = 0; i < wPatterns.length; i++) {
        var p1 = wPatterns[i];
        var pk1 = p1.patternKey;
        var c1 = counts[pk1] || { M: 0, F: 0 };

        if (c1.M === 0 && c1.F === 0) {
          var donorM = shLines.find(function (l) {
            return sexOf(l) === "M" && !isWeekendPattern(l.rdoDays) && !pairedLineIds.has(l.id);
          });
          var donorF = shLines.find(function (l) {
            return sexOf(l) === "F" && !isWeekendPattern(l.rdoDays) && !pairedLineIds.has(l.id);
          });

          if (donorM && donorF) {
            pairedLineIds.add(donorM.id);
            pairedLineIds.add(donorF.id);

            linePattern[donorM.id] = pk1;
            linePattern[donorF.id] = pk1;

            var p1Label = formatRdos(p1.rdoDays);

            proposals.push({
              lineA: donorF,
              lineB: donorM,
              shiftId: shId,
              rdoA_before: donorF.rdoDays,
              rdoB_before: donorM.rdoDays,
              rdoA_after: p1.rdoDays,
              rdoB_after: p1.rdoDays,
              note: shLabel + " shift: Assign pattern " + p1Label + " to " + (donorF.lineCode || donorF.id) + " (F) & " + (donorM.lineCode || donorM.id) + " (M)"
            });

            madeProgress = true;
            break;
          }
        }
      }

      if (!madeProgress) break;
    }

    var finalCounts = {};
    shLines.forEach(function (l) {
      var pk = linePattern[l.id];
      if (!finalCounts[pk]) finalCounts[pk] = { M: 0, F: 0 };
      if (sexOf(l) === "M") finalCounts[pk].M++;
      else if (sexOf(l) === "F") finalCounts[pk].F++;
    });

    weekendPatterns.forEach(function (p) {
      var fc = finalCounts[p.patternKey] || { M: 0, F: 0 };
      var pLabel = formatRdos(p.rdoDays);
      if (fc.M !== fc.F || fc.M === 0 || fc.F === 0) {
        disparities.push({
          shiftId: shId,
          patternKey: p.patternKey,
          rdoDays: p.rdoDays,
          countM: fc.M,
          countF: fc.F
        });

        if (fc.M === 0) shortfalls.push(shLabel + " shift short of Male line on pattern " + pLabel);
        if (fc.F === 0) shortfalls.push(shLabel + " shift short of Female line on pattern " + pLabel);
      }
    });
  });

  var summaryMsg = "";
  if (shortfalls.length > 0) {
    summaryMsg = "Class " + classKey + " parity shortfalls: " + shortfalls.join("; ");
  } else if (disparities.length > 0) {
    summaryMsg = "Class " + classKey + ": " + disparities.length + " pattern disparity/disparities found across shifts. Proposed swaps to achieve equal weekend RDO parity per shift.";
  } else {
    summaryMsg = "Class " + classKey + ": Patterns are balanced.";
  }

  return {
    disparities: disparities,
    shortfalls: shortfalls,
    proposals: proposals,
    summary: summaryMsg
  };
}

export function approveParitySwaps(S, swapPairs) {
  if (!S || !S.state || !Array.isArray(swapPairs) || !swapPairs.length) return false;

  var lines = S.state.lines || [];
  var days = (S.state.weekCount || 1) * 7;
  var count = 0;

  swapPairs.forEach(function (pair) {
    var lA = lines.find(function (l) { return String(l.id) === String(pair.lineAId); });
    var lB = lines.find(function (l) { return String(l.id) === String(pair.lineBId); });
    if (!lA || !lB) return;

    var newRdoA = pair.rdoA_after;
    var newRdoB = pair.rdoB_after;

    if (Array.isArray(newRdoA) && Array.isArray(newRdoB)) {
      lA.rdoDays = newRdoA.slice();
      lB.rdoDays = newRdoB.slice();

      if (S.buildScheduleForLine && S.state.schedule) {
        S.state.schedule[lA.id] = S.buildScheduleForLine(lA, days);
        S.state.schedule[lB.id] = S.buildScheduleForLine(lB, days);
      }

      // Rebuild functionRotation so duty days follow new work / RDO days
      if (S.state.functionRotation) {
        var rotA = [];
        var rotB = [];
        var schedA = S.state.schedule[lA.id] || [];
        var schedB = S.state.schedule[lB.id] || [];
        var dutyA = lA.function || "PAX";
        var dutyB = lB.function || "PAX";

        for (var d = 0; d < days; d++) {
          rotA[d] = schedA[d] === "WORK" ? dutyA : "OFF";
          rotB[d] = schedB[d] === "WORK" ? dutyB : "OFF";
        }
        S.state.functionRotation[lA.id] = rotA;
        S.state.functionRotation[lB.id] = rotB;
      }

      count++;
    }
  });

  if (count > 0) {
    notifySessionLines();
    if (S.updateStatus) S.updateStatus("Approved " + count + " RDO parity pattern swap(s).");
    if (S.renderAll) S.renderAll();
    if (S.__USE_SVELTE_LINES && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("lines:request-render"));
    } else if (S.renderLines) S.renderLines();
    return true;
  }
  return false;
}

export function attachParityReport(S) {
  if (!S) return;
  S.checkParity = function (classKey, selectedBandKeys) { return checkParity(S, classKey, selectedBandKeys); };
  S.approveParitySwaps = function (swapPairs) { return approveParitySwaps(S, swapPairs); };
}
