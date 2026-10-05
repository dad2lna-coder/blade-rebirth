// @ts-nocheck
// Legacy band → shift-requirement migration.
// Maps old { start, end, stsoMin/Max, ... } bands onto existing shifts
// only when start AND end match exactly. Ambiguous or unmatched bands
// are preserved on fc.bands and reported — never guessed.

import { emptyRequirements, num0 } from "./shifts.js";

function roleMinMax(band, role) {
  var key = role.toLowerCase();
  var min = band[key + "Min"] != null ? num0(band[key + "Min"]) : num0(band[key]);
  var max = band[key + "Max"] != null ? num0(band[key + "Max"]) : min;
  if (max < min) max = min;
  return { min: min, max: max };
}

function pushIssue(issues, msg, warnings) {
  warnings.push(msg);
  if (issues && Array.isArray(issues) && issues.indexOf(msg) < 0) issues.push(msg);
}

export function migrateFunctionCoverageConfig(fc, opts) {
  opts = opts || {};
  var shifts = Array.isArray(opts.shifts) ? opts.shifts : [];
  var issues = opts.issues;
  var result = {
    ok: true,
    migrated: false,
    mapped: 0,
    unmapped: [],
    ambiguous: [],
    warnings: []
  };

  if (!fc || typeof fc !== "object") return result;
  if (!fc.requirements || typeof fc.requirements !== "object") {
    fc.requirements = emptyRequirements();
  }
  ["STSO", "LTSO", "TSO"].forEach(function (role) {
    if (!fc.requirements[role] || typeof fc.requirements[role] !== "object") {
      fc.requirements[role] = {};
    }
  });

  var bands = Array.isArray(fc.bands) ? fc.bands : [];
  if (!bands.length) {
    delete fc.bands;
    return result;
  }

  var mappedTo = {};
  var keepBands = [];

  bands.forEach(function (band) {
    if (!band || typeof band !== "object" || !band.start || !band.end) {
      if (band) keepBands.push(band);
      result.ok = false;
      return;
    }
    var matches = shifts.filter(function (s) {
      return s && s.start === band.start && s.end === band.end;
    });
    if (!matches.length) {
      pushIssue(
        issues,
        "Function coverage: legacy band " + band.start + "–" + band.end +
          " could not be mapped to a shift (no exact start/end match).",
        result.warnings
      );
      result.unmapped.push({ start: band.start, end: band.end });
      keepBands.push(band);
      result.ok = false;
      return;
    }
    if (matches.length > 1) {
      pushIssue(
        issues,
        "Function coverage: legacy band " + band.start + "–" + band.end +
          " matches multiple shifts (" +
          matches.map(function (s) { return s.name || s.id; }).join(", ") +
          ") — not mapped.",
        result.warnings
      );
      result.ambiguous.push({
        start: band.start,
        end: band.end,
        shiftIds: matches.map(function (s) { return s.id; })
      });
      keepBands.push(band);
      result.ok = false;
      return;
    }
    var shift = matches[0];
    if (mappedTo[shift.id]) {
      pushIssue(
        issues,
        "Function coverage: multiple legacy bands map to shift " +
          (shift.name || shift.id) + " — not mapped.",
        result.warnings
      );
      result.ambiguous.push({ start: band.start, end: band.end, shiftId: shift.id });
      keepBands.push(band);
      result.ok = false;
      return;
    }
    mappedTo[shift.id] = true;
    ["STSO", "LTSO", "TSO"].forEach(function (role) {
      if (fc.requirements[role][shift.id]) return;
      var mm = roleMinMax(band, role);
      fc.requirements[role][shift.id] = { min: mm.min, max: mm.max };
    });
    if (!Array.isArray(fc.requirementShiftIds)) fc.requirementShiftIds = [];
    if (fc.requirementShiftIds.indexOf(shift.id) < 0) fc.requirementShiftIds.push(shift.id);
    result.mapped++;
  });

  if (keepBands.length) fc.bands = keepBands;
  else delete fc.bands;

  result.migrated = result.mapped > 0;
  return result;
}
