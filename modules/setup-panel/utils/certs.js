// @ts-nocheck
/** Cert pool config + Generate assignment. */
import {
  lineCertPosition,
  isOpsCertLine,
  certSliceKey,
  assignCertPoolsToLines,
  assignCertPools
} from "./certAssign.js";

import {
  readCertConfigFromDom,
  clearLineFunctions,
  assignCertifications
} from "./certsLegacy.js";

export {
  lineCertPosition,
  isOpsCertLine,
  certSliceKey,
  assignCertPoolsToLines,
  assignCertPools,
  readCertConfigFromDom,
  clearLineFunctions,
  assignCertifications
};

export function defaultCertPoolConfig() {
  return {
    pools: ["A", "B"],
    targetBPercent: 45,
    functionMap: { DFO: "B", BAG: "", PAX: "" }
  };
}

export function normalizeCertPoolConfig(raw) {
  var seed = defaultCertPoolConfig();
  if (!raw || typeof raw !== "object") return seed;
  var pools = Array.isArray(raw.pools)
    ? raw.pools.map(function (p) { return String(p == null ? "" : p).trim(); }).filter(Boolean)
    : seed.pools.slice();
  if (pools.indexOf("A") < 0) pools.unshift("A");
  if (pools.indexOf("B") < 0) pools.push("B");
  var pct = Number(raw.targetBPercent);
  if (!Number.isFinite(pct)) pct = seed.targetBPercent;
  pct = Math.max(0, Math.min(100, pct));
  var mapIn = raw.functionMap && typeof raw.functionMap === "object" ? raw.functionMap : {};
  var functionMap = {
    DFO: normalizeMapTarget(mapIn.DFO, seed.functionMap.DFO),
    BAG: normalizeMapTarget(mapIn.BAG, seed.functionMap.BAG),
    PAX: normalizeMapTarget(mapIn.PAX, seed.functionMap.PAX)
  };
  return { pools: pools, targetBPercent: pct, functionMap: functionMap };
}

function normalizeMapTarget(value, fallback) {
  if (value == null || value === "") return fallback == null ? "" : fallback;
  var s = String(value).trim();
  if (!s || s.toLowerCase() === "none") return "";
  return s;
}

export function normalizeCertPoolLabel(raw) {
  if (raw == null) return "";
  return String(raw).trim();
}

export function ensureCertPoolConfig(S) {
  if (!S.state) S.state = {};
  S.state.certPool = normalizeCertPoolConfig(S.state.certPool);
  return S.state.certPool;
}

export function readCertPoolFromDom(S) {
  ensureCertPoolConfig(S);
  var pctEl = typeof document !== "undefined" ? document.getElementById("cfg-cert-pool-b-pct") : null;
  var dfoEl = typeof document !== "undefined" ? document.getElementById("cfg-cert-map-dfo") : null;
  var bagEl = typeof document !== "undefined" ? document.getElementById("cfg-cert-map-bag") : null;
  var paxEl = typeof document !== "undefined" ? document.getElementById("cfg-cert-map-pax") : null;
  var raw = {
    pools: ["A", "B"],
    targetBPercent: pctEl ? pctEl.value : S.state.certPool.targetBPercent,
    functionMap: {
      DFO: dfoEl ? dfoEl.value : S.state.certPool.functionMap.DFO,
      BAG: bagEl ? bagEl.value : S.state.certPool.functionMap.BAG,
      PAX: paxEl ? paxEl.value : S.state.certPool.functionMap.PAX
    }
  };
  S.state.certPool = normalizeCertPoolConfig(raw);
  return S.state.certPool;
}

export function fillCertPoolForm(S) {
  var cfg = ensureCertPoolConfig(S);
  function put(id, v) {
    if (typeof document === "undefined") return;
    var el = document.getElementById(id);
    if (el && v != null) el.value = v;
  }
  put("cfg-cert-pool-b-pct", cfg.targetBPercent);
  put("cfg-cert-map-dfo", cfg.functionMap.DFO || "none");
  put("cfg-cert-map-bag", cfg.functionMap.BAG || "none");
  put("cfg-cert-map-pax", cfg.functionMap.PAX || "none");
}

export function attachCertPools(S) {
  if (!S) return;
  S.defaultCertPoolConfig = defaultCertPoolConfig;
  S.normalizeCertPoolConfig = normalizeCertPoolConfig;
  S.ensureCertPoolConfig = function () { return ensureCertPoolConfig(S); };
  S.readCertPoolFromDom = function () { return readCertPoolFromDom(S); };
  S.fillCertPoolForm = function () { return fillCertPoolForm(S); };
  S.assignCertPools = function () { return assignCertPools(S); };
  S.assignCertPoolsToLines = assignCertPoolsToLines;
  ensureCertPoolConfig(S);
}
