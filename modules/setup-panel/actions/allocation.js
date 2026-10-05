// @ts-nocheck
/** Attach Setup allocation helpers onto Scheduler. */
import { operatingSlots, refineBalance } from "../utils/slots.js";
import { allocateShiftHeadcounts, allocateSupervisoryHeadcounts } from "../utils/headcounts.js";
import { buildLines, buildSupervisoryLines } from "../utils/buildLines.js";
import { readCertConfigFromDom, clearLineFunctions, assignCertifications } from "../utils/certs.js";

export function attachAllocation(S) {
  if (!S) return;
  S.operatingSlots = operatingSlots;
  S.refineBalance = function (counts, slots, totalPeople, lockedIds) {
    return refineBalance(S, counts, slots, lockedIds);
  };
  S.allocateShiftHeadcounts = function (totalPeople, openMin, closeMin) {
    return allocateShiftHeadcounts(S, totalPeople, openMin, closeMin);
  };
  S.allocateSupervisoryHeadcounts = function (totalSup, openMin, closeMin, forceField, tsoLines) {
    return allocateSupervisoryHeadcounts(S, totalSup, openMin, closeMin, forceField, tsoLines);
  };
  S.buildLines = function (counts) { return buildLines(S, counts); };
  S.buildSupervisoryLines = function (supCounts, supType) {
    return buildSupervisoryLines(S, supCounts, supType);
  };
  S.readCertConfigFromDom = function () { return readCertConfigFromDom(S); };
  S.clearLineFunctions = function () { return clearLineFunctions(S); };
  S.assignCertifications = function () { return assignCertifications(S); };
}
