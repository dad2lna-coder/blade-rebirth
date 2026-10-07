/** Dates — Luxon only. weekdaySun0 matches old dayjs/JS: 0=Sun. */
function DateTime() {
  if (typeof window !== "undefined" && window.luxon && window.luxon.DateTime) return window.luxon.DateTime;
  if (typeof globalThis !== "undefined" && globalThis.luxon && globalThis.luxon.DateTime) return globalThis.luxon.DateTime;
  return null;
}

export function now() {
  var DT = DateTime();
  return DT ? DT.now() : new Date();
}

export function parseStartDate(val) {
  var DT = DateTime();
  if (DT) {
    if (!val) return DT.now().startOf("day");
    if (typeof val === "string") {
      var iso = DT.fromISO(val.slice(0, 10));
      if (iso.isValid) return iso.startOf("day");
    }
    if (val && typeof val.toJSDate === "function") return DT.fromJSDate(val.toJSDate()).startOf("day");
    if (val instanceof Date) return DT.fromJSDate(val).startOf("day");
    if (val && val.isValid && val.toISODate) return val.startOf ? val.startOf("day") : val;
    return DT.now().startOf("day");
  }
  // JS Date fallback
  var jsDate;
  if (!val) jsDate = new Date();
  else if (typeof val === "string") jsDate = new Date(val.slice(0, 10) + "T00:00:00");
  else if (val instanceof Date) jsDate = new Date(val.getTime());
  else if (val && val.toJSDate) jsDate = val.toJSDate();
  else jsDate = new Date();

  if (isNaN(jsDate.getTime())) jsDate = new Date();
  jsDate.setHours(0,0,0,0);

  return {
    isValid: true,
    weekday: jsDate.getDay() === 0 ? 7 : jsDate.getDay(),
    startOf: function () { return parseStartDate(jsDate); },
    plus: function (obj) {
      var d = new Date(jsDate.getTime());
      if (obj && obj.days) d.setDate(d.getDate() + obj.days);
      return parseStartDate(d);
    },
    toFormat: function (fmt) {
      var y = jsDate.getFullYear();
      var m = String(jsDate.getMonth() + 1).padStart(2, "0");
      var da = String(jsDate.getDate()).padStart(2, "0");
      if (fmt === "yyyy-MM-dd" || fmt === "YYYY-MM-DD") return y + "-" + m + "-" + da;
      return y + "-" + m + "-" + da;
    },
    toISODate: function () {
      var y = jsDate.getFullYear();
      var m = String(jsDate.getMonth() + 1).padStart(2, "0");
      var da = String(jsDate.getDate()).padStart(2, "0");
      return y + "-" + m + "-" + da;
    },
    toJSDate: function () { return jsDate; }
  };
}

export function toDateInputValue(d) {
  return parseStartDate(d).toFormat("yyyy-MM-dd");
}

export function addDays(d, n) {
  return parseStartDate(d).plus({ days: n });
}

export function weekdaySun0(d) {
  return parseStartDate(d).weekday % 7;
}

export function dj(val) {
  var dt = parseStartDate(val);
  return {
    startOf: function () { return dj(dt.toISODate()); },
    format: function (fmt) {
      var map = { "YYYY-MM-DD": "yyyy-MM-dd" };
      return dt.toFormat(map[fmt] || fmt);
    },
    add: function (n) { return dj(addDays(dt, n).toISODate()); },
    day: function () { return weekdaySun0(dt); },
    toISODate: function () { return dt.toISODate(); },
    toJSDate: function () { return dt.toJSDate(); }
  };
}
