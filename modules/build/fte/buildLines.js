// @ts-nocheck
/** Turn allocated headcounts into bid lines. */
import { policyFor } from "./gender.js";

export function createPRNG(seed) {
  var s = (seed >>> 0) || 1;
  return function () {
    var t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle(arr, prng) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(prng() * (i + 1));
    var tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

export function getBandKey(S, shiftId) {
  var shifts = (S && S.state && S.state.shifts) || [];
  var shift = shifts.find(function (s) { return s.id === shiftId; });
  if (!shift) return shiftId || "default";
  if (shift.crewGroupId) return "crew_" + shift.crewGroupId;
  var groups = (S && S.state && S.state.shiftCrewGroups) || [];
  var group = groups.find(function (g) { return g.shiftIds && g.shiftIds.indexOf(shiftId) !== -1; });
  if (group) return "crew_" + group.id;
  return shiftId;
}

function takeFromPools(S, pools, preferLongFt, placed, preferPt) {
  placed = placed || { M: 0, F: 0 };
  function ignores(emp) {
    return !!(S && S.state && policyFor(S.state, emp).ignoreGender);
  }
  function take(emp, sex) {
    var key = emp + sex;
    if (pools[key] > 0) { pools[key]--; return { empClass: emp, sex: sex }; }
    return null;
  }
  var genderedM = 0;
  var genderedF = 0;
  if (!ignores("FT")) { genderedM += S.state.ftM || 0; genderedF += S.state.ftF || 0; }
  if (!ignores("PT")) { genderedM += S.state.ptM || 0; genderedF += S.state.ptF || 0; }
  var startT = genderedM + genderedF;
  var targetFShare = startT > 0 ? genderedF / startT : 0.5;
  function pickSex(emp) {
    var mLeft = pools[emp + "M"] || 0, fLeft = pools[emp + "F"] || 0;
    if (mLeft <= 0 && fLeft <= 0) return null;
    if (ignores(emp)) {
      var openSex = mLeft >= fLeft ? "M" : "F";
      if (mLeft <= 0) openSex = "F";
      if (fLeft <= 0) openSex = "M";
      pools[emp + openSex]--;
      return { empClass: emp, sex: openSex };
    }
    if (mLeft <= 0) return take(emp, "F");
    if (fLeft <= 0) return take(emp, "M");
    var placedT = placed.M + placed.F;
    if (placedT === 0) return targetFShare >= 0.5 ? take(emp, "F") : take(emp, "M");
    var currentFShare = placed.F / placedT;
    if (currentFShare < targetFShare - 0.02) return take(emp, "F");
    if (currentFShare > targetFShare + 0.02) return take(emp, "M");
    return mLeft >= fLeft ? take(emp, "M") : take(emp, "F");
  }
  if (preferLongFt) return pickSex("FT");
  if (preferPt) return pickSex("PT") || pickSex("FT");
  var ftLeft = (pools.FTM || 0) + (pools.FTF || 0);
  var ptLeft = (pools.PTM || 0) + (pools.PTF || 0);
  if (ftLeft > 0) return pickSex("FT");
  if (ptLeft > 0) return pickSex("PT");
  return null;
}

function makeLineFromPerson(S, def, person, id) {
  var workDays = S.targetWorkDays(def.id, person.empClass);
  var rdoCount = 7 - workDays;
  var seed = (id - 1) % 7;
  var hard = Array.isArray(def.rdoHard)
    ? def.rdoHard.map(Number).filter(function (x) { return x >= 0 && x <= 6; })
    : [];
  var rdoDays;
  if (hard.length > 0) {
    rdoDays = hard.slice();
    if (rdoDays.length < rdoCount) {
      for (var d = 0; d < 7 && rdoDays.length < rdoCount; d++) {
        if (rdoDays.indexOf(d) < 0) rdoDays.push(d);
      }
    }
  } else rdoDays = S.consecutiveRdos(rdoCount, seed);
  return {
    id: id,
    lineCode: "Line " + String(id).padStart(3, "0"),
    shiftId: def.id,
    shiftName: def.name,
    shiftLabel: S.shiftLabel(def),
    empClass: person.empClass,
    sex: person.sex,
    function: "",
    rdoDays: rdoDays,
    rdoHard: hard.length > 0,
    paid: person.empClass === "PT"
      ? (function () {
          var hours = +(S.state && S.state.ptHoursPerDay);
          return Number.isFinite(hours) && hours > 0 ? Math.min(12, hours) : 4;
        })()
      : (def.paid || 8)
  };
}

export function buildLines(S, counts) {
  var pools = { FTM: S.state.ftM || 0, FTF: S.state.ftF || 0, PTM: S.state.ptM || 0, PTF: S.state.ptF || 0 };
  var placedGlobal = { M: 0, F: 0 };
  var shifts = S.state.shifts || [];
  var order = [];
  shifts.forEach(function (def) {
    var need = counts[def.id] || 0;
    if (need > 0 && (def.force || 0) > 0) order.push(def);
  });
  shifts.forEach(function (def) {
    var need = counts[def.id] || 0;
    if (need > 0 && !(def.force > 0)) order.push(def);
  });

  var hasActiveSeed = S.state && typeof S.state.activeSeed === "number";
  var prng = hasActiveSeed ? createPRNG(S.state.activeSeed + 500) : null;

  // Collect line slots per shift
  var slots = [];
  order.forEach(function (def) {
    var need = counts[def.id] || 0;
    var bandKey = getBandKey(S, def.id);
    var isLong = (+def.paid || 8) >= 10;
    for (var i = 0; i < need; i++) {
      slots.push({
        def: def,
        bandKey: bandKey,
        isLong: isLong,
        shiftIndex: i
      });
    }
  });

  // Group slots by bandKey
  var bands = {};
  slots.forEach(function (slot) {
    if (!bands[slot.bandKey]) bands[slot.bandKey] = [];
    bands[slot.bandKey].push(slot);
  });

  // Pass 1: Assign RDO seeds round-robin within each role x bandKey using seeded offset
  Object.keys(bands).forEach(function (bk) {
    var bSlots = bands[bk];
    var seedOffset = prng ? Math.floor(prng() * 7) : 0;
    var seedIdx = seedOffset;
    bSlots.forEach(function (slot) {
      slot.rdoSeed = seedIdx % 7;
      seedIdx++;
    });
  });

  // Pass 2: Assign sex and empClass (FT/PT) from pools onto slots across bands
  var remainingNonLongSeats = 0;
  slots.forEach(function (slot) {
    if (!slot.isLong) remainingNonLongSeats++;
  });

  var lines = [], id = 1;

  // Interleave slots by RDO seeds within each band using seeded bucket shuffle
  Object.keys(bands).forEach(function (bk) {
    var bSlots = bands[bk];
    var seedBuckets = {};
    bSlots.forEach(function (s) {
      var k = s.rdoSeed;
      if (!seedBuckets[k]) seedBuckets[k] = [];
      seedBuckets[k].push(s);
    });

    var maxLen = 0;
    Object.keys(seedBuckets).forEach(function (k) {
      if (seedBuckets[k].length > maxLen) maxLen = seedBuckets[k].length;
    });

    var seedOrder = prng ? seededShuffle([0, 1, 2, 3, 4, 5, 6], prng) : [0, 1, 2, 3, 4, 5, 6];
    var orderedSlots = [];
    for (var i = 0; i < maxLen; i++) {
      for (var sIdx = 0; sIdx < 7; sIdx++) {
        var s = seedOrder[sIdx];
        if (seedBuckets[s] && seedBuckets[s][i]) {
          orderedSlots.push(seedBuckets[s][i]);
        }
      }
    }

    // Calculate PT quota for this band fill across non-long seats
    var fillNeed = 0;
    orderedSlots.forEach(function (s) {
      if (!s.isLong) fillNeed++;
    });
    var ptLeft = (pools.PTM || 0) + (pools.PTF || 0);
    var ptQuota = 0;
    if (fillNeed > 0 && remainingNonLongSeats > 0 && ptLeft > 0) {
      ptQuota = Math.round((fillNeed * ptLeft) / remainingNonLongSeats);
      ptQuota = Math.max(0, Math.min(fillNeed, Math.min(ptLeft, ptQuota)));
    }
    var ptPlacedInFill = 0;

    // Assign people to orderedSlots
    orderedSlots.forEach(function (slot) {
      var def = slot.def;
      var isLong = slot.isLong;
      var preferPt = false;
      if (!isLong) {
        preferPt = ptPlacedInFill < ptQuota;
      }
      var person = takeFromPools(S, pools, isLong, placedGlobal, preferPt);
      if (!person) {
        S.state.issues.push(def.name + ": pool empty or 4x10 needs FT.");
        if (!isLong) {
          remainingNonLongSeats = Math.max(0, remainingNonLongSeats - 1);
        }
        return;
      }
      if (!isLong) {
        if (person.empClass === "PT") {
          ptPlacedInFill++;
        }
        remainingNonLongSeats = Math.max(0, remainingNonLongSeats - 1);
      }
      if (!policyFor(S.state, person.empClass).ignoreGender) placedGlobal[person.sex]++;
      slot.person = person;

      // Compute correct workDays and rdoDays based on assigned empClass (FT vs PT)
      var workDays = S.targetWorkDays(slot.def.id, person.empClass);
      var rdoCount = 7 - workDays;
      var hard = Array.isArray(slot.def.rdoHard)
        ? slot.def.rdoHard.map(Number).filter(function (x) { return x >= 0 && x <= 6; })
        : [];
      if (hard.length > 0) {
        slot.rdoDays = hard.slice();
        if (slot.rdoDays.length < rdoCount) {
          for (var d = 0; d < 7 && slot.rdoDays.length < rdoCount; d++) {
            if (slot.rdoDays.indexOf(d) < 0) slot.rdoDays.push(d);
          }
        }
        slot.rdoHard = true;
      } else {
        slot.rdoDays = S.consecutiveRdos(rdoCount, slot.rdoSeed);
        slot.rdoHard = false;
      }
    });
  });

  // Build final lines array in slot order
  slots.forEach(function (slot) {
    if (!slot.person) return;
    lines.push({
      id: id,
      lineCode: "Line " + String(id).padStart(3, "0"),
      shiftId: slot.def.id,
      shiftName: slot.def.name,
      shiftLabel: S.shiftLabel(slot.def),
      empClass: slot.person.empClass,
      sex: slot.person.sex,
      function: "",
      rdoDays: slot.rdoDays,
      rdoHard: slot.rdoHard,
      paid: slot.person.empClass === "PT"
        ? (function () {
            var hours = +(S.state && S.state.ptHoursPerDay);
            return Number.isFinite(hours) && hours > 0 ? Math.min(12, hours) : 4;
          })()
        : (slot.def.paid || 8)
    });
    id++;
  });

  return lines;
}

function takeSupervisoryFromPools(pools, targetFShare, placed) {
  placed = placed || { M: 0, F: 0 };
  function take(sex) {
    if (pools[sex] > 0) { pools[sex]--; return sex; }
    return null;
  }
  if (pools.M <= 0 && pools.F <= 0) return null;
  if (pools.M <= 0) return take("F");
  if (pools.F <= 0) return take("M");
  var placedT = placed.M + placed.F;
  if (placedT === 0) return targetFShare >= 0.5 ? take("F") : take("M");
  var currentFShare = placed.F / placedT;
  if (currentFShare < targetFShare - 0.02) return take("F");
  if (currentFShare > targetFShare + 0.02) return take("M");
  return pools.M >= pools.F ? take("M") : take("F");
}

export function buildSupervisoryLines(S, supCounts, supType) {
  var isLtso = supType === "LTSO";
  var pools = {
    M: isLtso ? (S.state.ltsoM || 0) : (S.state.stsoM || 0),
    F: isLtso ? (S.state.ltsoF || 0) : (S.state.stsoF || 0)
  };
  var totalM = pools.M;
  var totalF = pools.F;
  var totalSup = totalM + totalF;
  var targetFShare = totalSup > 0 ? totalF / totalSup : 0.5;
  var placedGlobal = { M: 0, F: 0 };
  var forceField = isLtso ? "ltsoForce" : "stsoForce";

  var hasActiveSeed = S.state && typeof S.state.activeSeed === "number";
  var prng = hasActiveSeed ? createPRNG(S.state.activeSeed + (isLtso ? 2000 : 1000)) : null;

  var shifts = S.state.shifts || [];
  var order = [];
  shifts.forEach(function (def) {
    var need = supCounts[def.id] || 0;
    if (need > 0 && (def[forceField] || 0) > 0) order.push(def);
  });
  shifts.forEach(function (def) {
    var need = supCounts[def.id] || 0;
    if (need > 0 && !(def[forceField] > 0)) order.push(def);
  });

  // Collect slots
  var slots = [];
  order.forEach(function (def) {
    var need = supCounts[def.id] || 0;
    var bandKey = getBandKey(S, def.id);
    for (var i = 0; i < need; i++) {
      slots.push({
        def: def,
        bandKey: bandKey
      });
    }
  });

  // Partition by bandKey
  var bands = {};
  slots.forEach(function (slot) {
    if (!bands[slot.bandKey]) bands[slot.bandKey] = [];
    bands[slot.bandKey].push(slot);
  });

  // Pass 1: Assign RDO seeds per bandKey round-robin using seeded offset
  Object.keys(bands).forEach(function (bk) {
    var bSlots = bands[bk];
    var seedOffset = prng ? Math.floor(prng() * 7) : 0;
    var seedIdx = seedOffset;
    bSlots.forEach(function (slot) {
      var workDays = (+slot.def.paid || 8) >= 10 ? 4 : 5;
      var rdoCount = 7 - workDays;
      var hard = Array.isArray(slot.def.rdoHard)
        ? slot.def.rdoHard.map(Number).filter(function (x) { return x >= 0 && x <= 6; })
        : [];
      slot.rdoSeed = seedIdx % 7;
      seedIdx++;
      if (hard.length > 0) {
        slot.rdoDays = hard.slice();
        if (slot.rdoDays.length < rdoCount) {
          for (var d = 0; d < 7 && slot.rdoDays.length < rdoCount; d++) {
            if (slot.rdoDays.indexOf(d) < 0) slot.rdoDays.push(d);
          }
        }
        slot.rdoHard = true;
      } else {
        slot.rdoDays = S.consecutiveRdos(rdoCount, slot.rdoSeed);
        slot.rdoHard = false;
      }
    });
  });

  // Pass 2: Assign sex from M/F pools, interleaving across RDO seeds within each bandKey using seeded shuffle
  Object.keys(bands).forEach(function (bk) {
    var bSlots = bands[bk];
    var seedBuckets = {};
    bSlots.forEach(function (s) {
      var k = s.rdoSeed;
      if (!seedBuckets[k]) seedBuckets[k] = [];
      seedBuckets[k].push(s);
    });

    var maxLen = 0;
    Object.keys(seedBuckets).forEach(function (k) {
      if (seedBuckets[k].length > maxLen) maxLen = seedBuckets[k].length;
    });

    var seedOrder = prng ? seededShuffle([0, 1, 2, 3, 4, 5, 6], prng) : [0, 1, 2, 3, 4, 5, 6];
    var orderedSlots = [];
    for (var i = 0; i < maxLen; i++) {
      for (var sIdx = 0; sIdx < 7; sIdx++) {
        var s = seedOrder[sIdx];
        if (seedBuckets[s] && seedBuckets[s][i]) {
          orderedSlots.push(seedBuckets[s][i]);
        }
      }
    }

    orderedSlots.forEach(function (slot) {
      var sex = takeSupervisoryFromPools(pools, targetFShare, placedGlobal);
      if (!sex) {
        S.state.issues.push(slot.def.name + ": " + supType + " pool empty.");
        return;
      }
      placedGlobal[sex]++;
      slot.filled = true;
      slot.sex = sex;
    });
  });

  // Build lines
  var lines = [];
  var startId = isLtso ? 20000 : 10000;
  var id = startId;

  slots.forEach(function (slot) {
    if (!slot.filled) return;
    lines.push({
      id: id,
      lineCode: supType + " " + String(lines.length + 1).padStart(2, "0"),
      shiftId: slot.def.id,
      shiftName: slot.def.name,
      shiftLabel: S.shiftLabel(slot.def),
      empClass: supType,
      position: supType,
      isLtso: isLtso,
      isStso: !isLtso,
      sex: slot.sex,
      function: "",
      rdoDays: slot.rdoDays,
      rdoHard: slot.rdoHard,
      paid: slot.def.paid || 8
    });
    id++;
  });

  return lines;
}
