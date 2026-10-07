export function timeToMin(t) {
  if (!t || typeof t !== "string") return 0;
  var p = t.split(":");
  return (+p[0] || 0) * 60 + (+p[1] || 0);
}

export function minToTime(m) {
  var normalized = ((m % 1440) + 1440) % 1440;
  var h = Math.floor(normalized / 60);
  var mm = normalized % 60;
  return String(h).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
}

export function isValidTimeText(value) {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value);
}

export function safeNumber(value, fallback, min, max) {
  var n = Number(value);
  if (!Number.isFinite(n)) n = fallback;
  if (typeof min === "number") n = Math.max(min, n);
  if (typeof max === "number") n = Math.min(max, n);
  return n;
}
