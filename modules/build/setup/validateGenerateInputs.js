// @ts-nocheck
/** Validate generate inputs before running the pipeline.
 *  Returns true if inputs are valid, false otherwise.
 *  Populates S.state.issues on failure.
 *  No DOM writes, no allocation calls.
 */
export function validateGenerateInputs(S) {
  if (!S.state.shifts || !S.state.shifts.length) {
    S.state.issues.push("Add at least one shift with a start and end time.");
    return false;
  }

  S.state.shifts.forEach(function (s) {
    if (!s.rdoHard || !s.rdoHard.length) return;
    var need = S.rdoCountForShift(s, "FT");
    if (s.rdoHard.length !== need) {
      if (s.rdoHard.length > need) {
        S.state.issues.push(s.name + ": hard RDOs checked " + s.rdoHard.length + " day(s) exceeds pattern target " + need + " (paid " + s.paid + "h). Extra hard days kept; work-day count drops.");
      } else {
        S.state.issues.push(s.name + ": hard RDOs checked " + s.rdoHard.length + " day(s); padded to pattern target " + need + " (paid " + s.paid + "h).");
      }
    }
  });

  var extraHead = 0;
  ((S.state && S.state.extraPositions) || []).forEach(function (p) {
    extraHead += (+p.m || 0) + (+p.f || 0);
  });
  var trainingHead = (+S.state.esti || 0) + (+S.state.msti || 0);
  var total = S.state.ftM + S.state.ftF + S.state.ptM + S.state.ptF;

  if (total <= 0 && extraHead <= 0 && trainingHead <= 0) {
    S.state.issues.push("Set FT/PT male and female headcounts above zero, or add an extra type with people.");
    return false;
  }

  var openMin = S.timeToMin(S.state.open);
  var closeMin = S.timeToMin(S.state.close);
  if (closeMin <= openMin) {
    S.state.issues.push("Close time must be after open time.");
    return false;
  }

  return true;
}