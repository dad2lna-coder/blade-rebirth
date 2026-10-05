// @ts-nocheck
/** Bind Alpha function coverage onto the setup session. No DOM reader — the form writes state. */
import { addDays, weekdaySun0 } from "../utils/dates.js";
import {
  bindDutyApi,
  lineRoleKey,
  computeShiftAnchors,
  phaseOfStart,
  isAmSide,
  lineStartMin,
} from "./lib/duty.js";
import { bindPoolsApi, ensureFunctionCoverage, getFunctionMode } from "./lib/pools.js";
import { bindShiftsApi } from "./lib/shifts.js";
import { bindAssignApi, generateFunctionAssignments } from "./lib/assign.js";

export function attachFunctionCoverage(S) {
  if (!S) return;
  if (!S.addDays) S.addDays = addDays;
  if (!S.weekdaySun0) S.weekdaySun0 = weekdaySun0;
  bindDutyApi(S);
  bindPoolsApi(S);
  bindShiftsApi(S);
  bindAssignApi(S);
  S.lineRoleKey = lineRoleKey;
  S.lineStartMin = lineStartMin;
  S.computeShiftAnchors = computeShiftAnchors;
  S.phaseOfStart = phaseOfStart;
  S.isAmSide = isAmSide;
  S.ensureFunctionCoverage = ensureFunctionCoverage;
  S.getFunctionMode = getFunctionMode;
  S.generateFunctionAssignments = function (opts) {
    return generateFunctionAssignments(opts);
  };
}
