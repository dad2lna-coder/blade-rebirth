import assert from "node:assert";
import { attachShiftMath } from "../src/build/logic/shiftClock.js";
import { assignRdoDays, consecutiveRdos } from "../src/build/logic/rdoDays.js";
import { placedRdosOk } from "../src/build/logic/rdoAssign.js";

// Logic half of Alpha tests/test-rdo-modes.mjs. The generate, respin, and
// rdoConstraintHtml cases stay on Alpha until those files are copied.
function timeToMin(t) {
  var parts = String(t || "0:0").split(":").map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}

function stub() {
  var S = {
    state: { shifts: [] },
    timeToMin: timeToMin,
    isValidTimeText: function (t) { return /^\d{2}:\d{2}$/.test(String(t || "")); },
    safeNumber: function (v, d) { return Number.isFinite(+v) ? +v : d; },
    DAYS: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  };
  attachShiftMath(S);
  return S;
}

function isConsecutiveBlock(days) {
  var s = days.slice().sort(function (a, b) { return a - b; });
  if (s.length < 2) return false;
  var breaks = 0;
  for (var i = 0; i < s.length; i++) {
    var a = s[i];
    var b = s[(i + 1) % s.length];
    if ((b - a + 7) % 7 !== 1) breaks++;
  }
  return breaks === 1;
}

function keyOf(days) {
  return days.slice().sort(function (a, b) { return a - b; }).join("-");
}

function weekendOnly(days) {
  return days.length > 0 && days.every(function (d) { return d === 0 || d === 5 || d === 6; });
}

function containingBlock(days, pin, length) {
  for (var start = 0; start < 7; start++) {
    var block = [];
    for (var i = 0; i < length; i++) block.push((start + i) % 7);
    if (block.indexOf(pin) < 0) continue;
    if (block.every(function (d) { return days.indexOf(d) >= 0; })) return block;
  }
  return null;
}

var S = stub();

for (var seed = 0; seed < 7; seed++) {
  for (var count = 1; count <= 3; count++) {
    var soft = assignRdoDays(S, { rdoMode: "off", rdoHard: [] }, count, seed);
    assert.deepStrictEqual(soft.rdoDays, consecutiveRdos(count, seed), "soft consecutive seed " + seed);
    assert.strictEqual(soft.mode, "off");
  }
}
var padded = assignRdoDays(S, { rdoHard: [3] }, 2, 5);
assert.deepStrictEqual(padded.rdoDays, [3, 0], "hard Wednesday still pads Sunday when no block is set");
var kept = assignRdoDays(S, { rdoHard: [2, 3, 6] }, 2, 0);
assert.deepStrictEqual(kept.rdoDays, [2, 3, 6], "extra hard days are kept");

[2, 3, 4].forEach(function (block) {
  var keys = {};
  for (var s = 0; s < 7; s++) {
    var placed = assignRdoDays(S, { rdoBlock: block, rdoPins: [] }, block, s);
    assert.strictEqual(placed.ok, true);
    assert.strictEqual(placed.rdoDays.length, block, "block " + block);
    assert.ok(isConsecutiveBlock(placed.block), "block " + block + " " + placed.block);
    assert.deepStrictEqual(placed.flex, []);
    keys[keyOf(placed.block)] = true;
  }
  assert.strictEqual(Object.keys(keys).length, 7, "block " + block + " rotates");
});

var flexHist = [0, 0, 0, 0, 0, 0, 0];
for (var flexSeed = 0; flexSeed < 70; flexSeed++) {
  var flexPlaced = assignRdoDays(S, { rdoBlock: 2, rdoPins: [] }, 3, flexSeed);
  assert.strictEqual(flexPlaced.flex.length, 1);
  flexHist[flexPlaced.flex[0]]++;
}
assert.ok(Math.max.apply(null, flexHist) - Math.min.apply(null, flexHist) <= 1, "flex " + flexHist.join(","));
assert.ok(flexHist[1] <= flexHist[4], "Monday is not heavier than Thursday");

for (var pin = 0; pin < 7; pin++) {
  var pinKeys = {};
  for (var pinSeed = 0; pinSeed < 14; pinSeed++) {
    var pinPlaced = assignRdoDays(S, { rdoBlock: 2, rdoPins: [pin], rdoHard: [0, 6] }, 3, pinSeed);
    assert.strictEqual(pinPlaced.ok, true);
    assert.ok(pinPlaced.block.indexOf(pin) < 0, "4x10 pair swallowed pin " + pin);
    assert.ok(pinPlaced.rdoDays.indexOf(pin) >= 0, "days include pin " + pin);
    assert.strictEqual(pinPlaced.block.length, 2);
    assert.ok(isConsecutiveBlock(pinPlaced.block));
    assert.deepStrictEqual(pinPlaced.flex, []);
    assert.strictEqual(pinPlaced.rdoDays.length, 3);
    pinKeys[keyOf(pinPlaced.block)] = true;
  }
  assert.ok(Object.keys(pinKeys).length >= 2, "pin " + pin + " rotates");
}

var tueFriSat = assignRdoDays(S, { rdoBlock: 2, rdoPins: [2] }, 3, 3);
assert.deepStrictEqual(tueFriSat.block, [5, 6], "Tue pin seed lands on Fri-Sat");
assert.deepStrictEqual(tueFriSat.rdoDays, [2, 5, 6]);
assert.ok(tueFriSat.block.indexOf(1) < 0 && tueFriSat.rdoDays.indexOf(1) < 0, "Tuesday pin does not force Monday off");

var missed = assignRdoDays(S, { rdoBlock: 2, rdoPinRequired: true, rdoPins: [], rdoHard: [1, 2] }, 2, 4);
assert.strictEqual(missed.ok, false);
assert.strictEqual(placedRdosOk(missed), false);
assert.deepStrictEqual(missed.rdoDays, []);
assert.ok(String(missed.error).indexOf("no day") >= 0);

var tight = assignRdoDays(S, { rdoBlock: 2, rdoPins: [0, 3] }, 2, 1);
assert.strictEqual(tight.ok, false);
assert.deepStrictEqual(tight.rdoDays, []);
assert.ok(String(tight.error).indexOf("do not fit") >= 0);

var fits = assignRdoDays(S, { rdoBlock: 4, rdoPins: [0, 3] }, 4, 1);
assert.strictEqual(fits.ok, true);
assert.deepStrictEqual(fits.block, [0, 1, 2, 3]);
assert.ok(fits.block.indexOf(0) >= 0 && fits.block.indexOf(3) >= 0);

var plain = { rdoBlock: 3, rdoPins: [5], paid: 10 };
var split = {
  rdoBlock: 3,
  rdoPins: [5],
  paid: 10,
  segments: [{ start: "06:00", end: "10:00" }, { start: "13:00", end: "17:00" }]
};
assert.deepStrictEqual(assignRdoDays(S, plain, 4, 2).rdoDays, assignRdoDays(S, split, 4, 2).rdoDays);

var norm = S.normalizeShift({
  id: "SX", name: "Split", paid: 10,
  rdoBlock: "4", rdoPins: ["0"], rdoPinRequired: true, rdoHard: [3],
  segments: [{ start: "05:00", end: "10:00" }, { start: "12:00", end: "16:30" }]
}, 0);
assert.strictEqual(norm.rdoBlock, 4);
assert.deepStrictEqual(norm.rdoPins, [0]);
assert.strictEqual(norm.rdoPinRequired, true);
assert.deepStrictEqual(norm.rdoHard, [0]);
assert.strictEqual(norm.segments[0].start, "05:00");
