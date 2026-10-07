import assert from "node:assert";
import { timeToMin, minToTime, isValidTimeText, safeNumber } from "../src/shared/logic/time.js";
import { weekdaySun0, toDateInputValue } from "../src/shared/logic/dates.js";
import { initShared } from "../src/shared/index.js";

assert.strictEqual(timeToMin("06:30"), 390);
assert.strictEqual(minToTime(390), "06:30");
assert.strictEqual(minToTime(-30), "23:30");
assert.strictEqual(isValidTimeText("08:00"), true);
assert.strictEqual(isValidTimeText("8:00"), false);
assert.strictEqual(safeNumber("nope", 4, 1, 6), 4);
assert.strictEqual(weekdaySun0("2026-10-04"), 0);
assert.strictEqual(toDateInputValue("2026-10-07"), "2026-10-07");

var session = {};
assert.deepStrictEqual(initShared(session), { ready: true });
assert.strictEqual(session.timeToMin("01:00"), 60);
assert.strictEqual(session.weekdaySun0("2026-10-05"), 1);
console.log("test-shared: ok");
