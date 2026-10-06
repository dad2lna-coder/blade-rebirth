// @ts-nocheck
/** Pure function: builds a day-by-day schedule array for a single line.
 *  No DOM access, no side effects, fully testable.
 */
import { parseStartDate, addDays, weekdaySun0 } from "../period/dates.js";

export function buildScheduleForLine(S, line, days) {
  var arr = [];
  var rdo = new Set((line.rdoDays || []).map(Number));
  var need = S.targetWorkDays(line.shiftId, line.empClass);
  var base = parseStartDate(S.state.startDate);
  var weeks = Math.ceil(days / 7);
  for (var w = 0; w < weeks; w++) {
    var weekOffsets = [];
    for (var i = 0; i < 7; i++) {
      var off = w * 7 + i;
      if (off >= days) break;
      weekOffsets.push({ off: off, dow: weekdaySun0(addDays(base, off)) });
    }
    var weekVal = {};
    weekOffsets.forEach(function (x) {
      weekVal[x.off] = rdo.has(x.dow) ? "RDO" : "WORK";
    });
    var workOffs = weekOffsets
      .filter(function (x) { return weekVal[x.off] === "WORK"; })
      .sort(function (a, b) { return a.dow - b.dow; });
    workOffs.forEach(function (x, idx) {
      weekVal[x.off] = idx < need ? "WORK" : "RDO";
    });
    weekOffsets.forEach(function (x) { arr[x.off] = weekVal[x.off]; });
  }
  for (var i = 0; i < days; i++) if (!arr[i]) arr[i] = "RDO";
  return arr.slice(0, days);
}