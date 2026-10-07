import { timeToMin, minToTime, isValidTimeText, safeNumber } from "./logic/time.js";
import { now, parseStartDate, toDateInputValue, addDays, weekdaySun0, dj } from "./logic/dates.js";

export function initShared(session) {
  if (!session) return { ready: false };
  session.timeToMin = timeToMin;
  session.minToTime = minToTime;
  session.isValidTimeText = isValidTimeText;
  session.safeNumber = safeNumber;
  session.now = now;
  session.parseStartDate = parseStartDate;
  session.toDateInputValue = toDateInputValue;
  session.addDays = addDays;
  session.weekdaySun0 = weekdaySun0;
  session.dj = dj;
  return { ready: true };
}
