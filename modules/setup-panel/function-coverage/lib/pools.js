// @ts-nocheck
let api = null;

import { normalizeRequirements } from "./shifts.js";
import { migrateFunctionCoverageConfig } from "./migrate.js";
import { bindCertifiedPoolsApi, buildCertifiedPools } from "./certifiedPools.js";

export { buildCertifiedPools };

export function bindPoolsApi(scheduler) {
  api = scheduler;
  bindCertifiedPoolsApi(scheduler);
}

function num0(v) { return Math.max(0, Math.floor(+v || 0)); }

export function bagPoolTotal(fc) {
  return num0(fc.poolStsoBagM) + num0(fc.poolStsoBagF) + num0(fc.poolLtsoBagM) + num0(fc.poolLtsoBagF) +
    num0(fc.poolTsoBagM) + num0(fc.poolTsoBagF);
}

export function dfoPoolTotal(fc) {
  return num0(fc.poolStsoDfoM) + num0(fc.poolStsoDfoF) + num0(fc.poolLtsoDfoM) + num0(fc.poolLtsoDfoF) +
    num0(fc.poolTsoDfoM) + num0(fc.poolTsoDfoF);
}

export function ensureFunctionCoverage() {
  if (!api.state.functionCoverage) api.state.functionCoverage = {};
  var fc = api.state.functionCoverage;
  ["poolStsoDfoM","poolStsoDfoF","poolLtsoDfoM","poolLtsoDfoF","poolTsoDfoM","poolTsoDfoF",
   "poolStsoBagM","poolStsoBagF","poolLtsoBagM","poolLtsoBagF","poolTsoBagM","poolTsoBagF",
   "poolTsoDfoPt"].forEach(function (k) {
    if (fc[k] == null) fc[k] = 0;
  });
  if (fc.poolStsoDfo == null) fc.poolStsoDfo = num0(fc.poolStsoDfoM) + num0(fc.poolStsoDfoF);
  if (fc.poolLtsoDfo == null) fc.poolLtsoDfo = num0(fc.poolLtsoDfoM) + num0(fc.poolLtsoDfoF);
  if (fc.poolTsoDfo == null) fc.poolTsoDfo = num0(fc.poolTsoDfoM) + num0(fc.poolTsoDfoF);
  if (fc.poolBag == null) fc.poolBag = bagPoolTotal(fc);
  if (!fc.poolStsoDfoM && !fc.poolStsoDfoF && fc.poolStsoDfo) fc.poolStsoDfoM = fc.poolStsoDfo;
  if (!fc.poolLtsoDfoM && !fc.poolLtsoDfoF && fc.poolLtsoDfo) fc.poolLtsoDfoM = fc.poolLtsoDfo;
  if (!fc.poolTsoDfoM && !fc.poolTsoDfoF && fc.poolTsoDfo) fc.poolTsoDfoM = fc.poolTsoDfo;
  if (!fc.poolTsoBagM && !fc.poolTsoBagF && fc.poolBag) fc.poolTsoBagM = fc.poolBag;
  if (fc.amPmSplit == null) fc.amPmSplit = true;
  if (fc.phaseThresholdMin == null) fc.phaseThresholdMin = 15;
  if (fc.bias == null) fc.bias = "none";
  if (!api.state.functionRotation) api.state.functionRotation = {};

  if (Array.isArray(fc.bands) && fc.bands.length && !fc._bandMigrationAttempted) {
    fc._bandMigrationAttempted = true;
    migrateFunctionCoverageConfig(fc, {
      shifts: (api.state && api.state.shifts) || [],
      issues: api.state && api.state.issues
    });
  }

  fc.requirements = normalizeRequirements(fc.requirements);
  if (!Array.isArray(fc.requirementShiftIds)) fc.requirementShiftIds = [];
  if (!fc.requirementShiftIds.length) {
    ["STSO", "LTSO", "TSO"].forEach(function (role) {
      Object.keys(fc.requirements[role] || {}).forEach(function (id) {
        if (fc.requirementShiftIds.indexOf(id) < 0) fc.requirementShiftIds.push(id);
      });
    });
  }

  delete fc.stsoIsDfo; delete fc.poolDfo; delete fc.poolPax;
  syncDerivedMode(fc);
  return fc;
}

export function getFunctionMode() {
  return syncDerivedMode(ensureFunctionCoverage());
}

export function fteCapsByRoleSex() {
  var st = api.state || {};
  return {
    STSO: { M: num0(st.stsoM), F: num0(st.stsoF) },
    LTSO: { M: num0(st.ltsoM), F: num0(st.ltsoF) },
    TSO: { M: num0(st.ftM) + num0(st.ptM), F: num0(st.ftF) + num0(st.ptF) }
  };
}

export function capFunctionPoolsToFte(fc, issues) {
  fc = fc || ensureFunctionCoverage();
  var caps = fteCapsByRoleSex();
  function capPair(role, bagMKey, bagFKey, dfoMKey, dfoFKey) {
    var capM = caps[role].M, capF = caps[role].F;
    var reqBagM = num0(fc[bagMKey]), reqBagF = num0(fc[bagFKey]);
    var reqDfoM = num0(fc[dfoMKey]), reqDfoF = num0(fc[dfoFKey]);
    if (reqBagM > capM) { if (issues) issues.push("BAG " + role + " M pool " + reqBagM + " exceeds FTE " + capM + " — capped."); reqBagM = capM; }
    if (reqBagF > capF) { if (issues) issues.push("BAG " + role + " F pool " + reqBagF + " exceeds FTE " + capF + " — capped."); reqBagF = capF; }
    var remM = Math.max(0, capM - reqBagM), remF = Math.max(0, capF - reqBagF);
    if (reqDfoM > remM) { if (issues) issues.push("DFO " + role + " M pool " + reqDfoM + " exceeds remaining FTE " + remM + " after BAG — capped."); reqDfoM = remM; }
    if (reqDfoF > remF) { if (issues) issues.push("DFO " + role + " F pool " + reqDfoF + " exceeds remaining FTE " + remF + " after BAG — capped."); reqDfoF = remF; }
    fc[bagMKey] = reqBagM; fc[bagFKey] = reqBagF; fc[dfoMKey] = reqDfoM; fc[dfoFKey] = reqDfoF;
  }
  capPair("STSO", "poolStsoBagM", "poolStsoBagF", "poolStsoDfoM", "poolStsoDfoF");
  capPair("LTSO", "poolLtsoBagM", "poolLtsoBagF", "poolLtsoDfoM", "poolLtsoDfoF");
  capPair("TSO", "poolTsoBagM", "poolTsoBagF", "poolTsoDfoM", "poolTsoDfoF");
  syncDerivedMode(fc);
  return fc;
}

function syncDerivedMode(fc) {
  var bag = bagPoolTotal(fc) > 0, dfo = dfoPoolTotal(fc) > 0;
  fc.poolBag = bagPoolTotal(fc);
  fc.poolStsoDfo = num0(fc.poolStsoDfoM) + num0(fc.poolStsoDfoF);
  fc.poolLtsoDfo = num0(fc.poolLtsoDfoM) + num0(fc.poolLtsoDfoF);
  fc.poolTsoDfo = num0(fc.poolTsoDfoM) + num0(fc.poolTsoDfoF);
  fc.mode = bag && dfo ? "both" : bag ? "bag" : dfo ? "dfo" : "none";
  return fc;
}
