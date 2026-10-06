// @ts-nocheck
/** Extra / add-on types — Setup owns cards, shift parking, and line build. */

function num0(v) {
  var n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function defaultExtraBands() {
  return [{ start: "04:00", end: "20:30", min: 1 }];
}

export function opsFteYes(pos) {
  if (!pos) return false;
  var v = pos.opsFte;
  if (v === true || v === 1) return true;
  var s = String(v == null ? "no" : v).trim().toLowerCase();
  return s === "yes" || s === "y" || s === "true" || s === "1";
}

export function extraTypeName(pos) {
  return String((pos && pos.name) || "Position").trim() || "Position";
}

export function lineInOpsCoverage(line) {
  if (!line) return false;
  if (line.isExtra || line.extraPositionId) return !!line.opsFte;
  return true;
}

function normalizeShiftCounts(raw, shifts) {
  var out = {};
  var src = raw && typeof raw === "object" ? raw : {};
  (shifts || []).forEach(function (s) {
    if (!s || !s.id) return;
    out[s.id] = num0(src[s.id]);
  });
  Object.keys(src).forEach(function (id) {
    if (out[id] == null) out[id] = num0(src[id]);
  });
  return out;
}

export function normalizeExtraPosition(pos, i, shifts) {
  pos = pos && typeof pos === "object" ? pos : {};
  if (!pos.id) pos.id = "extra-" + (i + 1);
  if (!pos.name) pos.name = "Position";
  pos.m = num0(pos.m);
  pos.f = num0(pos.f);
  pos.ignoreGender = !!pos.ignoreGender;
  pos.dropM = num0(pos.dropM);
  pos.dropF = num0(pos.dropF);
  pos.opsFte = opsFteYes(pos);
  if (!Array.isArray(pos.bands) || !pos.bands.length) pos.bands = defaultExtraBands();
  pos.shiftCounts = normalizeShiftCounts(pos.shiftCounts, shifts);
  return pos;
}

export function ensureExtraList(S) {
  if (!S.state) S.state = {};
  if (!Array.isArray(S.state.extraPositions)) S.state.extraPositions = [];
  var shifts = (S.state && S.state.shifts) || [];
  S.state.extraPositions.forEach(function (pos, i) {
    normalizeExtraPosition(pos, i, shifts);
  });
  return S.state.extraPositions;
}

function queryEl(S, sel) {
  if (S && typeof S.$ === "function") {
    try {
      var via = S.$(sel);
      if (via) return via;
    } catch (e) {}
  }
  if (typeof document !== "undefined") return document.querySelector(sel);
  return null;
}

export function readExtraListFromDom(S) {
  var list = ensureExtraList(S);
  var shifts = (S.state && S.state.shifts) || [];
  list.forEach(function (pos) {
    var nameEl = queryEl(S, '[data-extra-name="' + pos.id + '"]');
    var mEl = queryEl(S, '[data-extra-m="' + pos.id + '"]');
    var fEl = queryEl(S, '[data-extra-f="' + pos.id + '"]');
    var opsEl = queryEl(S, '[data-extra-ops="' + pos.id + '"]');
    if (nameEl) pos.name = String(nameEl.value || pos.name).trim() || pos.name;
    if (mEl) pos.m = num0(mEl.value);
    if (fEl) pos.f = num0(fEl.value);
    if (opsEl) pos.opsFte = String(opsEl.value || "no").toLowerCase() === "yes";
    if (!Array.isArray(pos.bands)) pos.bands = defaultExtraBands();
    for (var i = 0; i < pos.bands.length; i++) {
      var b = pos.bands[i] || {};
      ["start", "end", "min"].forEach(function (field) {
        var el = queryEl(S, '[data-extra-band="' + pos.id + '"][data-extra-bi="' + i + '"][data-extra-bf="' + field + '"]');
        if (!el) return;
        if (field === "min") b[field] = num0(el.value);
        else b[field] = el.value || b[field];
      });
      pos.bands[i] = b;
    }
    pos.shiftCounts = pos.shiftCounts || {};
    shifts.forEach(function (s) {
      if (!s || !s.id) return;
      var sc = queryEl(S, '[data-extra-shift-count="' + pos.id + '"][data-extra-shift-id="' + s.id + '"]');
      if (sc) pos.shiftCounts[s.id] = num0(sc.value);
    });
  });
  return list;
}

function extraShiftParkHtml(pos, shifts) {
  if (!shifts || !shifts.length) {
    return '<p class="muted extra-pos-shifts-empty">Add shifts to park this type on a start time.</p>';
  }
  var cells = shifts.map(function (s) {
    var n = pos.shiftCounts && pos.shiftCounts[s.id] != null ? num0(pos.shiftCounts[s.id]) : 0;
    var label = (s.name || s.id) + (s.start ? " " + s.start : "");
    return '<label class="extra-shift-park">' + label +
      ' <input type="number" min="0" max="99" data-extra-shift-count="' + pos.id +
      '" data-extra-shift-id="' + s.id + '" value="' + n + '" style="width:3.5rem"></label>';
  }).join("");
  return '<div class="extra-pos-shifts"><span class="muted">Park on shifts</span>' + cells + "</div>";
}

export function extraCardsHtml(list, shifts) {
  return (list || []).map(function (pos) {
    var rows = (pos.bands || []).map(function (b, i) {
      return "<tr>" +
        '<td><input type="time" data-extra-band="' + pos.id + '" data-extra-bi="' + i + '" data-extra-bf="start" value="' + (b.start || "04:00") + '" step="900"></td>' +
        '<td><input type="time" data-extra-band="' + pos.id + '" data-extra-bi="' + i + '" data-extra-bf="end" value="' + (b.end || "20:30") + '" step="900"></td>' +
        '<td><input type="number" min="0" max="99" data-extra-band="' + pos.id + '" data-extra-bi="' + i + '" data-extra-bf="min" value="' + (b.min != null ? b.min : 0) + '" style="width:3.5rem"></td>' +
        '<td><button type="button" class="btn btn-red btn-sm" data-extra-band-remove="' + pos.id + '" data-extra-bi="' + i + '">\u2715</button></td></tr>';
    }).join("");
    var ops = opsFteYes(pos) ? "yes" : "no";
    var safeName = String(pos.name || "").split('"').join("");
    return '<div class="extra-pos-card" data-extra-card="' + pos.id + '">' +
      '<div class="fte-sex-row extra-pos-head">' +
      '<label>Name <input type="text" data-extra-name="' + pos.id + '" value="' + safeName + '" style="width:7rem"></label>' +
      '<label>Male <input type="number" min="0" data-extra-m="' + pos.id + '" value="' + num0(pos.m) + '" style="width:4.5rem"></label>' +
      '<label>Female <input type="number" min="0" data-extra-f="' + pos.id + '" value="' + num0(pos.f) + '" style="width:4.5rem"></label>' +
      '<label>Ops FTE <select data-extra-ops="' + pos.id + '">' +
      '<option value="no"' + (ops === "no" ? " selected" : "") + ">No</option>" +
      '<option value="yes"' + (ops === "yes" ? " selected" : "") + ">Yes</option>" +
      "</select></label>" +
      '<button type="button" class="btn btn-red btn-sm" data-extra-remove="' + pos.id + '">Remove</button>' +
      '<button type="button" class="btn btn-sm" data-extra-add-band="' + pos.id + '">+ Band</button></div>' +
      extraShiftParkHtml(pos, shifts) +
      '<div class="lines-scroll extra-pos-bands"><table class="data-table"><thead><tr><th>Start</th><th>End</th><th>Min</th><th></th></tr></thead><tbody>' +
      rows + "</tbody></table></div></div>";
  }).join("");
}

function pickShiftQueue(pos, shifts, need) {
  var queue = [];
  var listed = shifts && shifts.length ? shifts : [];
  listed.forEach(function (s) {
    var c = num0(pos.shiftCounts && s && pos.shiftCounts[s.id]);
    for (var i = 0; i < c; i++) queue.push(s);
  });
  if (!queue.length && listed.length) {
    for (var k = 0; k < need; k++) queue.push(listed[k % listed.length]);
  } else if (queue.length < need && listed.length) {
    var seed = queue.length;
    while (queue.length < need) {
      queue.push(listed[seed % listed.length]);
      seed++;
    }
  }
  if (queue.length > need) queue = queue.slice(0, need);
  return queue;
}

function extraEmpClass(def, S) {
  var paid = +((def && def.paid) || 8);
  var marked = String((def && def.empClass) || "").trim().toUpperCase();
  if (marked === "PT") return "PT";
  var ptHours = S && S.state ? Number(S.state.ptHoursPerDay) : NaN;
  if (Number.isFinite(ptHours) && ptHours > 0 && paid > 0 && paid <= ptHours) return "PT";
  if (paid > 0 && paid < 8) return "PT";
  return "FT";
}

function rdoDaysFor(S, def, workDays, seed) {
  var rdoCount = Math.max(1, 7 - workDays);
  var hard = Array.isArray(def && def.rdoHard)
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
  } else if (S && S.consecutiveRdos) {
    rdoDays = S.consecutiveRdos(rdoCount, seed);
  } else {
    rdoDays = [0, 6];
  }
  while (rdoDays.length < rdoCount) {
    for (var e = 0; e < 7 && rdoDays.length < rdoCount; e++) {
      if (rdoDays.indexOf(e) < 0) rdoDays.push(e);
    }
  }
  return { rdoDays: rdoDays, hard: hard.length > 0 };
}

import { getBandKey, createPRNG, seededShuffle } from "./buildLines.js";

export function buildExtraPositionLines(S) {
  var out = [];
  var list = ensureExtraList(S);
  var shifts = (S.state && S.state.shifts) || [];
  var fallback = shifts[0] || { id: "", name: "Shift", start: "04:00", end: "20:30", paid: 8, rdoHard: [] };

  list.forEach(function (pos, pi) {
    var males = num0(pos.m);
    var females = num0(pos.f);
    var total = males + females;
    if (!total) return;
    if (!pos.bands || !pos.bands.length) {
      if (S.state && S.state.issues) S.state.issues.push((pos.name || "Position") + ": no coverage bands.");
    }

    var seed = ((S.state && S.state.activeSeed) || 42) + 3000 + pi * 100;
    var prng = createPRNG(seed);

    var typeName = extraTypeName(pos);
    var parked = pickShiftQueue(pos, shifts.length ? shifts : [fallback], total);

    // Collect slots for this extra position class
    var slots = [];
    for (var idx = 0; idx < total; idx++) {
      var def = parked[idx] || fallback;
      var bandKey = getBandKey(S, def.id);
      slots.push({
        def: def,
        bandKey: bandKey
      });
    }

    // Partition by bandKey
    var bands = {};
    slots.forEach(function (slot) {
      if (!bands[slot.bandKey]) bands[slot.bandKey] = [];
      bands[slot.bandKey].push(slot);
    });

    // Pass 1: Assign RDO seeds per bandKey round-robin using seeded offset
    Object.keys(bands).forEach(function (bk) {
      var bSlots = bands[bk];
      var seedOffset = Math.floor(prng() * 7);
      var seedIdx = seedOffset;
      bSlots.forEach(function (slot) {
        slot.rdoSeed = seedIdx % 7;
        seedIdx++;
      });
    });

    // Pass 2: Assign sex from M/F pools onto ordered slots across seed buckets using seeded shuffle
    var poolM = males, poolF = females;
    var targetFShare = total > 0 ? females / total : 0.5;
    var placedGlobal = { M: 0, F: 0 };

    function takeExtraSex() {
      if (poolM <= 0 && poolF <= 0) return null;
      if (poolM <= 0) { poolF--; return "F"; }
      if (poolF <= 0) { poolM--; return "M"; }
      var placedT = placedGlobal.M + placedGlobal.F;
      if (placedT === 0) {
        if (targetFShare >= 0.5) { poolF--; return "F"; }
        poolM--; return "M";
      }
      var currentFShare = placedGlobal.F / placedT;
      if (currentFShare < targetFShare - 0.02) { poolF--; return "F"; }
      if (currentFShare > targetFShare + 0.02) { poolM--; return "M"; }
      if (poolM >= poolF) { poolM--; return "M"; }
      poolF--; return "F";
    }

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

      var seedOrder = seededShuffle([0, 1, 2, 3, 4, 5, 6], prng);
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
        var sex = takeExtraSex();
        if (!sex) return;
        placedGlobal[sex]++;
        slot.filled = true;
        slot.sex = sex;

        var empClass = extraEmpClass(slot.def, S);
        var workDays = S.targetWorkDays ? S.targetWorkDays(slot.def.id, empClass) : ((+slot.def.paid || 8) >= 10 ? 4 : 5);
        var rdo = rdoDaysFor(S, slot.def, workDays, slot.rdoSeed);
        slot.empClass = empClass;
        slot.rdoDays = rdo.rdoDays;
        slot.rdoHard = rdo.hard;
      });
    });

    // Build lines for this extra position class
    var idBase = 30000 + pi * 1000;
    slots.forEach(function (slot, idx) {
      if (!slot.filled) return;
      out.push({
        id: idBase + idx + 1,
        lineCode: typeName + " " + String(idx + 1).padStart(2, "0"),
        shiftId: slot.def.id,
        shiftName: slot.def.name,
        shiftLabel: S.shiftLabel ? S.shiftLabel(slot.def) : ((slot.def.start || "") + "-" + (slot.def.end || "")),
        empClass: slot.empClass,
        position: typeName,
        isLtso: false,
        isStso: false,
        isExtra: true,
        extraPositionId: pos.id,
        extraName: typeName,
        opsFte: opsFteYes(pos),
        sex: slot.sex,
        function: "",
        rdoDays: slot.rdoDays,
        rdoHard: slot.rdoHard,
        paid: slot.def.paid || 8
      });
    });
  });

  return out;
}

export function attachExtraPositions(S) {
  if (!S) return;

  S.opsFteYes = opsFteYes;
  S.lineInOpsCoverage = lineInOpsCoverage;
  S.ensureExtraPositions = function () { return ensureExtraList(S); };
  S.readExtraPositionsFromDom = function () { return readExtraListFromDom(S); };
  S.buildExtraPositionLines = function () { return buildExtraPositionLines(S); };

  S.renderExtraPositions = function () {
    var host = typeof document !== "undefined" ? document.getElementById("extra-pos-list") : null;
    if (!host) return;
    var list = ensureExtraList(S);
    host.innerHTML = extraCardsHtml(list, (S.state && S.state.shifts) || []);
  };

  S.addExtraPosition = function (name) {
    readExtraListFromDom(S);
    var list = ensureExtraList(S);
    list.push(normalizeExtraPosition({
      id: "extra-" + Date.now() + "-" + (list.length + 1),
      name: name || "Position",
      m: 0,
      f: 0,
      opsFte: false,
      bands: defaultExtraBands(),
      shiftCounts: {}
    }, list.length, (S.state && S.state.shifts) || []));
    S.renderExtraPositions();
  };

  if (typeof document !== "undefined" && !S._extraDocBound) {
    S._extraDocBound = true;
    document.addEventListener("click", function (e) {
      var t = e.target;
      if (!t || !t.getAttribute) return;
      var rem = t.getAttribute("data-extra-remove");
      if (rem != null) {
        readExtraListFromDom(S);
        S.state.extraPositions = ensureExtraList(S).filter(function (p) { return p.id !== rem; });
        S.renderExtraPositions();
        return;
      }
      var addBand = t.getAttribute("data-extra-add-band");
      if (addBand != null) {
        readExtraListFromDom(S);
        var list = ensureExtraList(S);
        var pos = null;
        for (var i = 0; i < list.length; i++) if (list[i].id === addBand) pos = list[i];
        if (pos) {
          if (!Array.isArray(pos.bands)) pos.bands = defaultExtraBands();
          pos.bands.push({ start: "04:00", end: "20:30", min: 1 });
        }
        S.renderExtraPositions();
        return;
      }
      var bandRem = t.getAttribute("data-extra-band-remove");
      var bi = t.getAttribute("data-extra-bi");
      if (bandRem != null) {
        readExtraListFromDom(S);
        var list2 = ensureExtraList(S);
        var p2 = null;
        for (var j = 0; j < list2.length; j++) if (list2[j].id === bandRem) p2 = list2[j];
        if (p2 && Array.isArray(p2.bands)) p2.bands.splice(+bi, 1);
        S.renderExtraPositions();
      }
    });
  }
}
