// @ts-nocheck
import { defaultCertPoolConfig, normalizeCertPoolConfig } from "./certs.js";

export function lineCertPosition(line) {
  if (!line) return "";
  if (line.isExtra || line.extraPositionId) {
    if (!line.opsFte) return "";
    return String(line.extraName || line.position || "").trim();
  }
  if (line.isStso || line.empClass === "STSO") return "STSO";
  if (line.isLtso || line.empClass === "LTSO") return "LTSO";
  if (line.empClass === "FT" || line.empClass === "PT" || line.empClass === "TSO" || !line.empClass) {
    return "TSO";
  }
  return "";
}

export function isOpsCertLine(line) {
  var pos = lineCertPosition(line);
  return !!pos;
}

export function certSliceKey(line) {
  var pos = lineCertPosition(line);
  if (!pos) return "";
  var sex = line && (line.sex === "M" || line.sex === "F") ? line.sex : "";
  return sex ? pos + ":" + sex : pos;
}

function mappedPoolForFunction(fn, cfg) {
  var key = String(fn || "").toUpperCase();
  if (key !== "DFO" && key !== "BAG" && key !== "PAX") return "";
  var mapped = cfg && cfg.functionMap ? cfg.functionMap[key] : "";
  return mapped ? String(mapped) : "";
}

function parseMin(v, timeToMin) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof timeToMin === "function") {
    var n = timeToMin(v);
    if (Number.isFinite(n)) return n;
  }
  var s = String(v || "");
  var m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return 0;
  return (+m[1]) * 60 + (+m[2]);
}

function lineWorksDay(line, day, schedule) {
  if (!schedule) return true;
  var arr = schedule[line.id] || schedule[String(line.id)];
  if (!Array.isArray(arr) || !arr.length) return true;
  return (arr[day] || "RDO") === "WORK";
}

function shiftWindow(line, ctx) {
  var sh = ctx.getShift ? ctx.getShift(line.shiftId) : null;
  var start = parseMin(sh && sh.start, ctx.timeToMin);
  var end = parseMin(sh && sh.end, ctx.timeToMin);
  if (end <= start) end += 24 * 60;
  return { start: start, end: end };
}

function coversHour(line, day, hour, ctx) {
  if (!lineWorksDay(line, day, ctx.schedule)) return false;
  var win = shiftWindow(line, ctx);
  var h = hour;
  if (h < win.start && win.end > 24 * 60) h += 24 * 60;
  return h >= win.start && h < win.end;
}

function dayOpenClose(day, ctx) {
  var open = ctx.openMin;
  var close = ctx.closeMin;
  if (ctx.dayHours && ctx.dayHours[day]) {
    open = parseMin(ctx.dayHours[day].open, ctx.timeToMin);
    close = parseMin(ctx.dayHours[day].close, ctx.timeToMin);
  }
  if (!Number.isFinite(open)) open = 0;
  if (!Number.isFinite(close) || close <= open) close = open + 24 * 60;
  return { open: open, close: close };
}

function hourList(ctx, slice) {
  var hours = [];
  var seen = {};
  for (var d = 0; d < 7; d++) {
    var oc = dayOpenClose(d, ctx);
    var start = oc.open;
    var end = oc.close;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      slice.forEach(function (line) {
        var win = shiftWindow(line, ctx);
        if (win.start < start || start === 0) start = win.start;
        if (win.end > end) end = win.end;
      });
    }
    for (var h = start; h < end; h += 60) {
      var key = d + ":" + h;
      if (seen[key]) continue;
      seen[key] = true;
      hours.push({ day: d, hour: h });
    }
  }
  return hours;
}

function hourIsShort(slot, slice, cfg, ctx) {
  var present = [];
  slice.forEach(function (line) {
    if (coversHour(line, slot.day, slot.hour, ctx)) present.push(line);
  });
  if (!present.length) return false;
  var haveB = present.filter(function (l) { return l.certPool === "B"; }).length;
  var needB = Math.ceil(present.length * (cfg.targetBPercent / 100) - 1e-9);
  return haveB < needB;
}

function fillSliceByHour(slice, cfg, ctx) {
  slice.forEach(function (line) {
    var mapped = mappedPoolForFunction(line.function, cfg);
    line.certPool = mapped || "";
  });
  var slots = hourList(ctx, slice);
  var guard = 0;
  var max = slice.length * 8;
  while (guard++ < max) {
    var shortSlots = slots.filter(function (slot) {
      return hourIsShort(slot, slice, cfg, ctx);
    });
    if (!shortSlots.length) break;
    var best = null;
    var bestScore = 0;
    slice.forEach(function (line) {
      if (line.certPool) return;
      var score = 0;
      shortSlots.forEach(function (slot) {
        if (coversHour(line, slot.day, slot.hour, ctx)) score++;
      });
      if (score > bestScore) {
        bestScore = score;
        best = line;
      } else if (score === bestScore && score > 0 && best && (line.id || 0) < (best.id || 0)) {
        best = line;
      }
    });
    if (!best || bestScore <= 0) break;
    best.certPool = "B";
  }
  slice.forEach(function (line) {
    if (!line.certPool) line.certPool = "A";
  });
}

export function assignCertPoolsToLines(lines, cfg, shiftStartMin) {
  cfg = normalizeCertPoolConfig(cfg);
  var list = Array.isArray(lines) ? lines : [];
  var ctx = typeof shiftStartMin === "function"
    ? { startMinOf: shiftStartMin, schedule: null, getShift: null, timeToMin: null, openMin: 0, closeMin: 24 * 60, dayHours: null }
    : (shiftStartMin && typeof shiftStartMin === "object" ? shiftStartMin : {});
  if (!ctx.startMinOf) {
    ctx.startMinOf = function () { return 0; };
  }
  var slices = {};

  list.forEach(function (line) {
    if (!line) return;
    if (line.isExtra || line.extraPositionId) {
      if (!line.opsFte) {
        line.certPool = "";
        return;
      }
    }
    var key = certSliceKey(line);
    if (!key) {
      line.certPool = "";
      return;
    }
    if (!slices[key]) slices[key] = [];
    slices[key].push(line);
  });

  Object.keys(slices).forEach(function (key) {
    fillSliceByHour(slices[key], cfg, ctx);
  });

  list.forEach(function (line) {
    if (!line) return;
    var extra = !!(line.isExtra || line.extraPositionId);
    if (extra && !line.opsFte) {
      line.certPool = "";
      return;
    }
    if (!extra && !line.certPool) line.certPool = "A";
  });
  return list;
}

export function assignCertPools(S) {
  if (!S || !S.state) return;
  if (S.ensureCertPoolConfig) S.ensureCertPoolConfig();
  if (typeof document !== "undefined" && document.getElementById("cfg-cert-pool-b-pct") && S.readCertPoolFromDom) {
    S.readCertPoolFromDom();
  }
  var openMin = S.timeToMin && S.state.open ? S.timeToMin(S.state.open) : 0;
  var closeMin = S.timeToMin && S.state.close ? S.timeToMin(S.state.close) : 24 * 60;
  assignCertPoolsToLines(S.state.lines || [], S.state.certPool, {
    startMinOf: function (line) {
      if (S.getShift && S.timeToMin) {
        var sh = S.getShift(line.shiftId);
        return sh ? S.timeToMin(sh.start) : 0;
      }
      return 0;
    },
    getShift: S.getShift,
    timeToMin: S.timeToMin,
    schedule: S.state.schedule || {},
    openMin: openMin,
    closeMin: closeMin,
    dayHours: S.state.useDynamicHours ? S.state.dayHours : null
  });
}
