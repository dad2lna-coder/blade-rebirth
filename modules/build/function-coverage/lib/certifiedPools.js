// @ts-nocheck
import { getShiftRequirement } from "./shifts.js";
import { positionMatchesSex } from "../../fte/gender.js";

let api = null;

export function bindCertifiedPoolsApi(scheduler) {
  api = scheduler;
}

function shiftStartMin(shiftId) {
  var sh = api.getShift ? api.getShift(shiftId) : null;
  if (!sh) return 1e9;
  if (api.timeToMin && sh.start != null) return api.timeToMin(sh.start);
  return 1e9;
}

export function buildCertifiedPools(fc, scheduler) {
  if (scheduler) api = scheduler;
  fc = fc || (api && api.ensureFunctionCoverage ? api.ensureFunctionCoverage() : {});
  var lines = api.state.lines || [];
  lines.forEach(function (l) {
    if (l.isExtra || l.extraPositionId) return;
    l.functionEligible = { dfo: false, bag: false, pax: false };
    l.function = "";
  });
  var anchors = api.computeShiftAnchors();
  var thr = fc.phaseThresholdMin || 15;

  function ensureEligible(line) {
    if (!line.functionEligible || typeof line.functionEligible !== "object") line.functionEligible = { dfo: false, bag: false, pax: false };
    return line.functionEligible;
  }

  function unused(role, sex) {
    return lines.filter(function (l) {
      if (l.isExtra || l.extraPositionId) return false;
      var el = ensureEligible(l);
      return api.lineRoleKey(l) === role && positionMatchesSex(l, sex) && !el.bag && !el.dfo;
    });
  }

  function markBag(role, sex, n) {
    if (!n || n <= 0) return { total: 0 };
    var pool = unused(role, sex).slice();
    pool.sort(function (a, b) { return api.lineStartMin(a) - api.lineStartMin(b) || String(a.id).localeCompare(String(b.id)); });
    var taken = 0;
    for (var i = 0; i < pool.length && taken < n; i++) { ensureEligible(pool[i]).bag = true; taken++; }
    return { total: taken };
  }

  function isPtLine(line) {
    if (!line) return false;
    if (line.isPt === true) return true;
    return String(line.empClass || "").trim().toUpperCase() === "PT";
  }

  function num0(v) { return Math.max(0, Math.floor(+v || 0)); }

  function clampTsoPtDfo() {
    var cap = num0(fc.poolTsoDfoPt);
    var pts = [];
    lines.forEach(function (l) {
      if (!l || l.isExtra || l.extraPositionId) return;
      if (api.lineRoleKey(l) !== "TSO") return;
      if (!isPtLine(l)) return;
      var el = ensureEligible(l);
      if (el.bag || !el.dfo) return;
      pts.push(l);
    });
    pts.sort(function (a, b) {
      var d = api.lineStartMin(b) - api.lineStartMin(a);
      if (d) return d;
      return String(b.id).localeCompare(String(a.id));
    });
    var cleared = 0;
    while (pts.length > cap) {
      var drop = pts.shift();
      ensureEligible(drop).dfo = false;
      cleared++;
    }
    if (cleared && api.state) {
      if (!api.state.issues) api.state.issues = [];
      var msg = "PT DFO capped to " + cap;
      if (api.state.issues.indexOf(msg) < 0) api.state.issues.push(msg);
    }
    return cleared;
  }

  function recountDfoSides(arr) {
    var am = 0, pm = 0;
    arr.forEach(function (res) {
      am += res.am || 0;
      pm += res.pm || 0;
    });
    var total = 0;
    lines.forEach(function (l) {
      if (!l || l.isExtra || l.extraPositionId) return;
      if (api.lineRoleKey(l) !== "TSO") return;
      var el = l.functionEligible;
      if (el && el.dfo && !el.bag) total++;
    });
    return { total: total, am: am, pm: pm };
  }

  var ptReserveLeft = num0(fc.poolTsoDfoPt);

  function tsoPtDfoCount() {
    var used = 0;
    lines.forEach(function (l) {
      if (!l || l.isExtra || l.extraPositionId) return;
      if (api.lineRoleKey(l) !== "TSO") return;
      if (!isPtLine(l)) return;
      var el = l.functionEligible;
      if (el && el.dfo && !el.bag) used++;
    });
    return used;
  }

  function tryMarkTsoDfo(cand) {
    var el = ensureEligible(cand);
    if (el.bag || el.dfo) return false;
    if (isPtLine(cand)) {
      if (ptReserveLeft <= 0) return false;
      el.dfo = true;
      ptReserveLeft--;
      return true;
    }
    el.dfo = true;
    return true;
  }

  function fillPtReserveBySwap() {
    var want = num0(fc.poolTsoDfoPt);
    ["M", "F"].forEach(function (sex) {
      while (tsoPtDfoCount() < want) {
        var unusedPt = unused("TSO", sex).filter(isPtLine);
        var ftDfo = lines.filter(function (l) {
          if (!l || l.isExtra || l.extraPositionId) return false;
          if (api.lineRoleKey(l) !== "TSO" || isPtLine(l)) return false;
          if (l.sex && l.sex !== sex) return false;
          var el = ensureEligible(l);
          return el.dfo && !el.bag;
        });
        if (!unusedPt.length || !ftDfo.length) break;
        unusedPt.sort(preferFtThenStart);
        ftDfo.sort(function (a, b) {
          var d = api.lineStartMin(b) - api.lineStartMin(a);
          if (d) return d;
          return String(b.id).localeCompare(String(a.id));
        });
        ensureEligible(ftDfo[0]).dfo = false;
        ensureEligible(unusedPt[0]).dfo = true;
        if (ptReserveLeft > 0) ptReserveLeft--;
      }
    });
  }

  function preferFtThenStart(a, b) {
    var ap = isPtLine(a) ? 1 : 0;
    var bp = isPtLine(b) ? 1 : 0;
    if (ap !== bp) return ap - bp;
    return api.lineStartMin(a) - api.lineStartMin(b) || String(a.id).localeCompare(String(b.id));
  }

  function markDfo(role, sex, n) {
    if (!n || n <= 0) return { am: 0, pm: 0, total: 0 };
    var pool = unused(role, sex).slice();
    var targets = [];
    var seen = {};
    var fromReqs = false;
    var recs = (fc.requirements && fc.requirements[role]) || {};
    Object.keys(recs).forEach(function (id) {
      var req = getShiftRequirement(role, id, fc);
      if (req.min <= 0 && req.max <= 0) return;
      if (typeof api.getShift === "function" && !api.getShift(id)) return;
      var key = String(id);
      if (seen[key]) return;
      seen[key] = true;
      targets.push(key);
      fromReqs = true;
    });
    if (!targets.length) {
      pool.forEach(function (l) {
        if (!l || l.shiftId == null || l.shiftId === "") return;
        var key = String(l.shiftId);
        if (seen[key]) return;
        seen[key] = true;
        targets.push(key);
      });
    }
    targets.sort(function (a, b) {
      var d = shiftStartMin(a) - shiftStartMin(b);
      if (d) return d;
      return String(a).localeCompare(String(b));
    });

    var buckets = {};
    targets.forEach(function (id) { buckets[id] = []; });
    pool.forEach(function (l) {
      var key = l.shiftId != null ? String(l.shiftId) : "";
      if (buckets[key]) buckets[key].push(l);
    });
    function sortLines(arr) {
      arr.sort(function (a, b) {
        if (role === "TSO") return preferFtThenStart(a, b);
        return api.lineStartMin(a) - api.lineStartMin(b) || String(a.id).localeCompare(String(b.id));
      });
    }
    targets.forEach(function (id) { sortLines(buckets[id]); });

    var nAlloc = Math.min(n, pool.length);
    var weights = targets.map(function (id) {
      if (!fromReqs) return 1;
      return Math.max(getShiftRequirement(role, id, fc).min, 1);
    });
    var sumW = 0;
    weights.forEach(function (w) { sumW += w; });
    if (!sumW) sumW = 1;

    var quotas = [];
    var fracs = [];
    var assigned = 0;
    targets.forEach(function (id, i) {
      var raw = nAlloc * weights[i] / sumW;
      var q = Math.floor(raw);
      quotas[i] = q;
      assigned += q;
      fracs.push({ i: i, frac: raw - q });
    });
    fracs.sort(function (a, b) {
      if (b.frac !== a.frac) return b.frac - a.frac;
      return a.i - b.i;
    });
    var leftover = nAlloc - assigned;
    for (var fi = 0; fi < fracs.length && leftover > 0; fi++) {
      quotas[fracs[fi].i]++;
      leftover--;
    }

    leftover = 0;
    targets.forEach(function (id, i) {
      var cap = buckets[id].length;
      if (quotas[i] > cap) {
        leftover += quotas[i] - cap;
        quotas[i] = cap;
      }
    });
    while (leftover > 0) {
      var best = -1;
      var bestRem = -1;
      for (var si = 0; si < targets.length; si++) {
        var rem = buckets[targets[si]].length - quotas[si];
        if (rem <= 0) continue;
        if (rem > bestRem) {
          bestRem = rem;
          best = si;
        }
      }
      if (best < 0) break;
      quotas[best]++;
      leftover--;
    }

    var tagged = [];
    targets.forEach(function (id, i) {
      var arr = buckets[id];
      var want = quotas[i];
      for (var j = 0; j < arr.length && tagged.length < n && want > 0; j++) {
        var cand = arr[j];
        var el = ensureEligible(cand);
        if (el.bag || el.dfo) continue;
        if (role === "TSO") {
          if (!tryMarkTsoDfo(cand)) continue;
        } else {
          el.dfo = true;
        }
        tagged.push(cand);
        want--;
      }
    });
    if (tagged.length < n) {
      var rest = unused(role, sex).slice();
      sortLines(rest);
      for (var k = 0; k < rest.length && tagged.length < n; k++) {
        var cand2 = rest[k];
        var el2 = ensureEligible(cand2);
        if (el2.bag || el2.dfo) continue;
        if (role === "TSO") {
          if (!tryMarkTsoDfo(cand2)) continue;
        } else {
          el2.dfo = true;
        }
        tagged.push(cand2);
      }
    }

    var gotAm = 0, gotPm = 0;
    tagged.forEach(function (l) {
      if (api.isAmSide(api.lineStartMin(l), anchors, thr)) gotAm++;
      else gotPm++;
    });
    return { am: gotAm, pm: gotPm, total: tagged.length };
  }

  var bag = {
    stso: { m: markBag("STSO", "M", fc.poolStsoBagM).total, f: markBag("STSO", "F", fc.poolStsoBagF).total },
    ltso: { m: markBag("LTSO", "M", fc.poolLtsoBagM).total, f: markBag("LTSO", "F", fc.poolLtsoBagF).total },
    tso: { m: markBag("TSO", "M", fc.poolTsoBagM).total, f: markBag("TSO", "F", fc.poolTsoBagF).total }
  };
  bag.stso.total = bag.stso.m + bag.stso.f;
  bag.ltso.total = bag.ltso.m + bag.ltso.f;
  bag.tso.total = bag.tso.m + bag.tso.f;
  var dfo = {
    stso: markDfo("STSO", "M", fc.poolStsoDfoM), stsoF: markDfo("STSO", "F", fc.poolStsoDfoF),
    ltso: markDfo("LTSO", "M", fc.poolLtsoDfoM), ltsoF: markDfo("LTSO", "F", fc.poolLtsoDfoF),
    tso: markDfo("TSO", "M", fc.poolTsoDfoM), tsoF: markDfo("TSO", "F", fc.poolTsoDfoF)
  };
  fillPtReserveBySwap();
  clampTsoPtDfo();
  var tsoSides = recountDfoSides([dfo.tso, dfo.tsoF]);
  return {
    bag: bag,
    stso: { total: dfo.stso.total + dfo.stsoF.total, am: dfo.stso.am + dfo.stsoF.am, pm: dfo.stso.pm + dfo.stsoF.pm },
    ltso: { total: dfo.ltso.total + dfo.ltsoF.total, am: dfo.ltso.am + dfo.ltsoF.am, pm: dfo.ltso.pm + dfo.ltsoF.pm },
    tso: tsoSides,
    anchors: anchors
  };
}
