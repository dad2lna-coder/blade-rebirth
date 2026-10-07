/** Shift record normalize. Body copied from Alpha shiftMath.js. */
import { normalizeRdoBlock, normalizeRdoPins } from "./rdoBlock.js";
import { normalizeRdoMode, normalizeConstraintDay } from "./rdoDays.js";

export function normalizeShift(S, raw, index) {
  var fallbackId = "S" + (index + 1);
  var id = raw && raw.id ? String(raw.id) : fallbackId;
  var name = raw && raw.name ? String(raw.name) : id;

  var segments = null;
  if (raw && raw.segments && Array.isArray(raw.segments) && raw.segments.length === 2) {
    var seg0 = raw.segments[0];
    var seg1 = raw.segments[1];
    if (seg0 && seg1 &&
        S.isValidTimeText(seg0.start) && S.isValidTimeText(seg0.end) &&
        S.isValidTimeText(seg1.start) && S.isValidTimeText(seg1.end)) {
      var m0Start = S.timeToMin(seg0.start);
      var m0End = S.timeToMin(seg0.end);
      var m1Start = S.timeToMin(seg1.start);
      var m1End = S.timeToMin(seg1.end);
      if (m0End > m0Start && m1End > m1Start && m1Start > m0End) {
        segments = [
          { start: seg0.start, end: seg0.end },
          { start: seg1.start, end: seg1.end }
        ];
      }
    }
  }

  var start = segments ? segments[0].start : (raw && S.isValidTimeText(raw.start) ? raw.start : "08:00");
  var end = segments ? segments[1].end : (raw && S.isValidTimeText(raw.end) ? raw.end : "16:30");

  var paid = S.safeNumber(raw && raw.paid, 8, 1, 24);
  var force = Math.floor(S.safeNumber(raw && raw.force, 0, 0, null));
  var ltsoForce = Math.floor(S.safeNumber(raw && raw.ltsoForce, 0, 0, null));
  var stsoForce = Math.floor(S.safeNumber(raw && raw.stsoForce, 0, 0, null));
  var rdoHard = Array.isArray(raw && raw.rdoHard)
    ? raw.rdoHard.map(Number).filter(function (x) {
        return Number.isInteger(x) && x >= 0 && x <= 6;
      })
    : [];

  var dayTimes = null;
  if (raw && raw.dayTimes && typeof raw.dayTimes === "object") {
    dayTimes = {};
    for (var k in raw.dayTimes) {
      if (!Object.prototype.hasOwnProperty.call(raw.dayTimes, k)) continue;
      var dt = raw.dayTimes[k];
      if (dt) {
        if (dt.segments && Array.isArray(dt.segments) && dt.segments.length === 2) {
          var d0 = dt.segments[0], d1 = dt.segments[1];
          if (d0 && d1 && S.isValidTimeText(d0.start) && S.isValidTimeText(d0.end) &&
              S.isValidTimeText(d1.start) && S.isValidTimeText(d1.end)) {
            var dm0s = S.timeToMin(d0.start), dm0e = S.timeToMin(d0.end);
            var dm1s = S.timeToMin(d1.start), dm1e = S.timeToMin(d1.end);
            if (dm0e > dm0s && dm1e > dm1s && dm1s > dm0e) {
              dayTimes[String(k)] = {
                start: d0.start,
                end: d1.end,
                segments: [
                  { start: d0.start, end: d0.end },
                  { start: d1.start, end: d1.end }
                ]
              };
              continue;
            }
          }
        }
        if (S.isValidTimeText(dt.start) && S.isValidTimeText(dt.end)) {
          dayTimes[String(k)] = { start: dt.start, end: dt.end };
        }
      }
    }
    if (!Object.keys(dayTimes).length) dayTimes = null;
  }

  var phase = (raw && raw.phase) || "auto";
  if (["auto", "opening", "am", "pm", "closing"].indexOf(phase) < 0) phase = "auto";
  var crewGroupId = raw && raw.crewGroupId ? String(raw.crewGroupId) : "";

  var rdoMode = normalizeRdoMode(raw);
  var rdoConstraint = normalizeConstraintDay(raw);
  var rdoBlock = normalizeRdoBlock(raw);
  var rdoPins = normalizeRdoPins(raw);
  var rdoPinRequired = !!(raw && (raw.rdoPinRequired === true || raw.rdoPinRequired === 1 || raw.rdoPinRequired === "true"));
  if (rdoBlock) rdoHard = rdoPins.slice();

  var result = {
    id: id, name: name, start: start, end: end, paid: paid,
    force: force, ltsoForce: ltsoForce, stsoForce: stsoForce, rdoHard: rdoHard,
    rdoMode: rdoMode, rdoConstraint: rdoConstraint,
    rdoBlock: rdoBlock, rdoPins: rdoPins, rdoPinRequired: rdoPinRequired,
    dayTimes: dayTimes, phase: phase, crewGroupId: crewGroupId
  };
  if (segments) result.segments = segments;
  return result;
}

