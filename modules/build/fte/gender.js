// @ts-nocheck
/** Per-position gender. Ignore gender assigns no sex. dropM/dropF still get lines but are not counted M/F. */

var KEYS = ["FT", "PT", "LTSO", "STSO"];

export function emptyGender() {
  return { ignoreGender: false, dropM: 0, dropF: 0 };
}

function floor0(value) {
  var n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function ensurePositionGender(state) {
  if (!state) return {};
  if (!state.positionGender || typeof state.positionGender !== "object") state.positionGender = {};
  KEYS.forEach(function (key) {
    var row = state.positionGender[key] || {};
    state.positionGender[key] = {
      ignoreGender: !!row.ignoreGender,
      dropM: floor0(row.dropM),
      dropF: floor0(row.dropF),
    };
  });
  return state.positionGender;
}

export function policyFor(state, key) {
  var all = ensurePositionGender(state || {});
  return all[key] || emptyGender();
}

export function linePositionKey(line) {
  if (!line) return "";
  if (line.isTraining || line.trainingClass || line.empClass === "ESTI" || line.empClass === "MSTI") return "";
  if (line.isExtra || line.extraPositionId) return "EXTRA:" + String(line.extraPositionId || "");
  if (line.isStso || line.empClass === "STSO" || line.position === "STSO") return "STSO";
  if (line.isLtso || line.empClass === "LTSO" || line.position === "LTSO") return "LTSO";
  if (line.empClass === "PT" || line.isPt === true) return "PT";
  if (line.empClass === "FT" || line.empClass === "TSO" || line.position === "TSO" || !line.empClass) return "FT";
  return "";
}

export function policyForLine(state, line) {
  var key = linePositionKey(line);
  if (!key) return emptyGender();
  if (key.indexOf("EXTRA:") === 0) {
    var id = key.slice(6);
    var list = (state && state.extraPositions) || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i] && String(list[i].id) === id) {
        return {
          ignoreGender: !!list[i].ignoreGender,
          dropM: floor0(list[i].dropM),
          dropF: floor0(list[i].dropF),
        };
      }
    }
    return emptyGender();
  }
  return policyFor(state, key);
}

export function classIgnoresGender(state, classKey) {
  if (classKey === "STSO" || classKey === "LTSO" || classKey === "FT" || classKey === "PT") {
    return !!policyFor(state, classKey).ignoreGender;
  }
  if (classKey === "TSO") {
    return !!policyFor(state, "FT").ignoreGender && !!policyFor(state, "PT").ignoreGender;
  }
  if (classKey && String(classKey).indexOf("EXTRA_") === 0) {
    var id = String(classKey).substring(6);
    var list = (state && state.extraPositions) || [];
    for (var i = 0; i < list.length; i++) {
      var pos = list[i];
      if (pos && (pos.id === id || pos.name === id)) return !!pos.ignoreGender;
    }
  }
  return false;
}

/** Counted M / counted F / total lines from the inputs on one position. */
export function plannedHeadcount(male, female, policy) {
  var males = floor0(male);
  var females = floor0(female);
  var dropM = Math.min(males, floor0(policy && policy.dropM));
  var dropF = Math.min(females, floor0(policy && policy.dropF));
  var ignore = !!(policy && policy.ignoreGender);
  return {
    M: ignore ? 0 : males - dropM,
    F: ignore ? 0 : females - dropF,
    T: males + females,
  };
}

export function countedSex(line) {
  if (!line || line.countSex === false) return "";
  if (line.sex === "M" || line.sex === "F") return line.sex;
  return "";
}

export function applyPositionGender(state, lines) {
  if (!state || !lines) return lines;
  var groups = {};
  lines.forEach(function (line) {
    var key = linePositionKey(line);
    if (!key) return;
    if (!groups[key]) groups[key] = [];
    groups[key].push(line);
  });
  Object.keys(groups).forEach(function (key) {
    var policy = policyForLine(state, groups[key][0]);
    var ordered = groups[key].slice().sort(function (a, b) {
      return (+a.id || 0) - (+b.id || 0);
    });
    var seenM = 0;
    var seenF = 0;
    var dropM = floor0(policy.dropM);
    var dropF = floor0(policy.dropF);
    ordered.forEach(function (line) {
      if (policy.ignoreGender) {
        line.sex = "";
        line.countSex = false;
        return;
      }
      var sex = line.sex === "F" ? "F" : (line.sex === "M" ? "M" : "");
      line.sex = sex;
      if (sex === "M" && seenM < dropM) {
        seenM++;
        line.countSex = false;
        return;
      }
      if (sex === "F" && seenF < dropF) {
        seenF++;
        line.countSex = false;
        return;
      }
      line.countSex = !!sex;
    });
  });
  return lines;
}

export function genderStatusNote(state) {
  var parts = [];
  KEYS.forEach(function (key) {
    var policy = policyFor(state, key);
    if (policy.ignoreGender) parts.push(key + " gender ignored");
    else if (policy.dropM || policy.dropF) parts.push(key + " drop " + policy.dropM + "M/" + policy.dropF + "F");
  });
  ((state && state.extraPositions) || []).forEach(function (pos) {
    var name = String((pos && pos.name) || "Position");
    if (pos && pos.ignoreGender) parts.push(name + " gender ignored");
    else if (pos && (floor0(pos.dropM) || floor0(pos.dropF))) {
      parts.push(name + " drop " + floor0(pos.dropM) + "M/" + floor0(pos.dropF) + "F");
    }
  });
  return parts.length ? " · " + parts.join(", ") : "";
}

/** Blank sex fills either side. A real M or F stays on that side. No position is special-cased. */
export function positionMatchesSex(line, sex) {
  if (!line || !line.sex) return true;
  return line.sex === sex;
}
