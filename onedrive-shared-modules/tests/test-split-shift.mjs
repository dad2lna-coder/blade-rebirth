import assert from "node:assert";
import { attachShiftMath } from "../src/build/logic/shiftClock.js";

function timeToMin(t) {
  if (!t) return 0;
  var parts = String(t).split(":").map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}

function isValidTimeText(t) {
  return /^\d{2}:\d{2}$/.test(String(t));
}

var S = {
  state: { shifts: [] },
  timeToMin: timeToMin,
  isValidTimeText: isValidTimeText,
  safeNumber: function (v, d) { return Number.isFinite(+v) ? +v : d; }
};

attachShiftMath(S);

// 1. Test normalizeShift with split segments
var rawSplit = {
  id: "S_SPLIT",
  name: "Split Shift",
  segments: [
    { start: "05:00", end: "10:00" },
    { start: "12:00", end: "17:00" }
  ]
};

var normalized = S.normalizeShift(rawSplit, 0);
assert.strictEqual(normalized.start, "05:00", "Top-level start is outer start bound");
assert.strictEqual(normalized.end, "17:00", "Top-level end is outer end bound");
assert.ok(Array.isArray(normalized.segments), "segments exists");
assert.strictEqual(normalized.segments.length, 2, "2 segments present");

S.state.shifts = [normalized];

// 2. Test shiftLabel
var label = S.shiftLabel(normalized);
assert.strictEqual(label, "0500-1000 / 1200-1700", "Formats label as HHMM-HHMM / HHMM-HHMM");

// 3. Test shiftCoversSlot slot coverage
var slot0930 = S.timeToMin("09:30");
var slot1030 = S.timeToMin("10:30");
var slot1100 = S.timeToMin("11:00");
var slot1200 = S.timeToMin("12:00");
var slot1630 = S.timeToMin("16:30");
var slot1700 = S.timeToMin("17:00");

assert.strictEqual(S.shiftCoversSlot("S_SPLIT", slot0930), true, "Covers 09:30 (segment 1)");
assert.strictEqual(S.shiftCoversSlot("S_SPLIT", slot1030), false, "Does NOT cover 10:30 (mid-day gap)");
assert.strictEqual(S.shiftCoversSlot("S_SPLIT", slot1100), false, "Does NOT cover 11:00 (mid-day gap)");
assert.strictEqual(S.shiftCoversSlot("S_SPLIT", slot1200), true, "Covers 12:00 (segment 2 start)");
assert.strictEqual(S.shiftCoversSlot("S_SPLIT", slot1630), true, "Covers 16:30 (segment 2)");
assert.strictEqual(S.shiftCoversSlot("S_SPLIT", slot1700), false, "Does NOT cover 17:00 (segment 2 end)");

// 4. Test invalid segment fallback
var rawInvalid = {
  id: "S_BAD",
  start: "05:00",
  end: "17:00",
  segments: [
    { start: "05:00", end: "12:00" },
    { start: "11:00", end: "17:00" }
  ]
};
var normInvalid = S.normalizeShift(rawInvalid, 1);
assert.strictEqual(normInvalid.segments, undefined, "Invalid split segments stripped back to contiguous");

console.log("ALL SPLIT SHIFT UNIT TESTS PASSED SUCCESSFULLY!");
