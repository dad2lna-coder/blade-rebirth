// @ts-nocheck
/** Force + free-pool headcount allocation across shifts. */
import { operatingSlots, refineBalance } from "../shifts/slots.js";

export function allocateShiftHeadcounts(S, totalPeople, openMin, closeMin) {
  var slots = operatingSlots(openMin, closeMin);
  var eligible = (S.state.shifts || []).filter(function (s) {
    return S.shiftOverlapsWindow(s, openMin, closeMin);
  });
  if (!eligible.length || totalPeople <= 0) return { counts: {}, mode: "none" };

  var forced = {}, forcedSum = 0;
  eligible.forEach(function (s) {
    var p = Math.max(0, Math.floor(Number(s.force) || 0));
    if (p > 0) { forced[s.id] = p; forcedSum += p; }
  });

  if (forcedSum > totalPeople) {
    S.state.issues.push("Force total (" + forcedSum + ") exceeds staff (" + totalPeople + ") — scaled down proportionally.");
    var scale = totalPeople / forcedSum, used = 0;
    var ids = Object.keys(forced);
    ids.forEach(function (id, i) {
      if (i === ids.length - 1) forced[id] = totalPeople - used;
      else { forced[id] = Math.floor(forced[id] * scale); used += forced[id]; }
    });
    forcedSum = totalPeople;
  }

  var freePool = totalPeople - forcedSum;
  var freeShifts = eligible.filter(function (s) { return !forced[s.id]; });
  if (freePool > 0 && !freeShifts.length) {
    S.state.issues.push("All shifts have Force > 0 but " + freePool + " people left unassigned — add a shift with Force 0 or raise a force.");
  }

  var counts = Object.assign({}, forced);
  freeShifts.forEach(function (s) { counts[s.id] = counts[s.id] || 0; });

  if (freeShifts.length && freePool > 0) {
    var weights = freeShifts.map(function (s) {
      var w = 0;
      slots.forEach(function (slot) { if (S.shiftCoversSlot(s.id, slot)) w++; });
      return Math.max(1, w);
    });
    var wsum = weights.reduce(function (a, b) { return a + b; }, 0);
    var assigned = 0;
    freeShifts.forEach(function (s, i) {
      if (i === freeShifts.length - 1) counts[s.id] = (counts[s.id] || 0) + (freePool - assigned);
      else {
        var n = Math.floor((freePool * weights[i]) / wsum);
        counts[s.id] = (counts[s.id] || 0) + n;
        assigned += n;
      }
    });
  }
  return { counts: counts, mode: "heuristic" };
}

export function allocateSupervisoryHeadcounts(S, totalSup, openMin, closeMin, forceField, tsoLines) {
  var slots = operatingSlots(openMin, closeMin);
  var eligible = (S.state.shifts || []).filter(function (s) {
    return S.shiftOverlapsWindow(s, openMin, closeMin);
  });
  if (!eligible.length || totalSup <= 0) return { counts: {} };

  var forced = {}, forcedSum = 0;
  eligible.forEach(function (s) {
    var p = Math.max(0, Math.floor(Number(s[forceField]) || 0));
    if (p > 0) { forced[s.id] = p; forcedSum += p; }
  });
  if (forcedSum > totalSup) {
    S.state.issues.push(forceField.replace("Force", "").toUpperCase() + " force total (" + forcedSum + ") exceeds pool (" + totalSup + ") — scaled down.");
    var scale = totalSup / forcedSum, used = 0;
    var ids = Object.keys(forced);
    ids.forEach(function (id, i) {
      if (i === ids.length - 1) forced[id] = totalSup - used;
      else { forced[id] = Math.floor(forced[id] * scale); used += forced[id]; }
    });
    forcedSum = totalSup;
  }
  var freePool = totalSup - forcedSum;
  var freeShifts = eligible.filter(function (s) { return !forced[s.id]; });
  var counts = Object.assign({}, forced);
  freeShifts.forEach(function (s) { counts[s.id] = counts[s.id] || 0; });
  if (freeShifts.length && freePool > 0) {
    var tsoOn = {};
    (tsoLines || S.state.lines || []).forEach(function (l) {
      if (l.isStso || l.isLtso) return;
      tsoOn[l.shiftId] = (tsoOn[l.shiftId] || 0) + 1;
    });
    var weights = freeShifts.map(function (s) {
      if (tsoOn[s.id] > 0) return tsoOn[s.id];
      var w = 0;
      slots.forEach(function (slot) { if (S.shiftCoversSlot(s.id, slot)) w++; });
      return Math.max(1, w);
    });
    var wsum = weights.reduce(function (a, b) { return a + b; }, 0) || 1;
    var assigned = 0;
    freeShifts.forEach(function (s, i) {
      if (i === freeShifts.length - 1) counts[s.id] = (counts[s.id] || 0) + (freePool - assigned);
      else {
        var n = Math.floor((freePool * weights[i]) / wsum);
        counts[s.id] = (counts[s.id] || 0) + n;
        assigned += n;
      }
    });
  }
  return { counts: refineBalance(S, counts, slots, forced) };
}
