// @ts-nocheck
/**
 * eBid 45-column (A–AS) mapper.
 * Primary source is the live scheduler lines. JSON / lines-CSV import is a fallback.
 * Column order matches "Shift Bid Upload Template v3" BidLines, not the Info-sheet
 * numbering typo (that sheet repeats column 41).
 */

export const EBID_HEADERS = [
  "Airport Code",
  "Shift Bid Event ID",
  "Schedule Start Date",
  "Schedule End Date",
  "Bid Line ID",
  "Location/Workgroup",
  "Patdown Req",
  "Title",
  "Certification",
  "Schedule Type",
  "Shift Time",
  "Private Bid Line Comments",
  "Public Bid Line Comments",
  "D01 Shift Time", "D02 Shift Time", "D03 Shift Time", "D04 Shift Time",
  "D05 Shift Time", "D06 Shift Time", "D07 Shift Time", "D08 Shift Time",
  "D09 Shift Time", "D10 Shift Time", "D11 Shift Time", "D12 Shift Time",
  "D13 Shift Time", "D14 Shift Time",
  "D01 Shift Type", "D02 Shift Type", "D03 Shift Type", "D04 Shift Type",
  "D05 Shift Type", "D06 Shift Type", "D07 Shift Type", "D08 Shift Type",
  "D09 Shift Type", "D10 Shift Type", "D11 Shift Type", "D12 Shift Type",
  "D13 Shift Type", "D14 Shift Type",
  "RDOs",
  "Hours/Day",
  "Hours/PP",
  "Days/Week"
];

export const EBID_COLUMNS = [
  { id: 1, header: "Airport Code", values: "3-letter airport code", desc: "3 letter airport code (e.g. ANC, LAX, SFO)." },
  { id: 2, header: "Shift Bid Event ID", values: "Full bid event name, up to 100 characters", desc: "Same value on every line. Must match the Bid Event name in eBid. The v3 sheet says 10 characters; this export keeps the full name you type." },
  { id: 3, header: "Schedule Start Date", values: "YYYY-MM-DD", desc: "Date the schedule becomes effective. D01 is this calendar day, not a hard-coded Sunday." },
  { id: 4, header: "Schedule End Date", values: "YYYY-MM-DD", desc: "Date through which the schedule stays in effect (the bid season, not the 14-day pattern)." },
  { id: 5, header: "Bid Line ID", values: "Text, up to 8 characters", desc: "The Line column from the lines table, unchanged (Line 001 stays Line 001). Unique within the airport. eBid allows 8 characters." },
  { id: 6, header: "Location/Workgroup", values: "Text, up to 30 characters", desc: "Team or checkpoint. Numeric Alpha teams export as Team 01. Blank if the line is not on a team — not a sample name." },
  { id: 7, header: "Patdown Req", values: "Female, Male, None", desc: "Sex required for pat downs on this bid line." },
  { id: 8, header: "Title", values: "TSO, LTSO, ETSO, STSO, ESTI, MSTI, STI, SSA, SSTI, EMT, Single Group", desc: "Rank required. Emp class PT/FT is not a title." },
  { id: 9, header: "Certification", values: "PAX, BAG, DUAL", desc: "From the line function. BAG stays BAG, DFO exports as DUAL, PAX stays PAX. Cert pool letter is not a certification." },
  { id: 10, header: "Schedule Type", values: "FT, PT", desc: "Full-time or part-time. STSO and LTSO are FT. Not inferred from weekly hours." },
  { id: 11, header: "Shift Time", values: "9 chars, 19 chars, or RDO", desc: "Typical military span, breaks included (0400-1230). Split shifts use one space (0900-1300 1500-1900)." },
  { id: 12, header: "Private Bid Line Comments", values: "Text, up to 255 characters", desc: "Scheduling office only. Left blank by this export." },
  { id: 13, header: "Public Bid Line Comments", values: "Text, up to 255 characters", desc: "Bidder-visible. Cert pool is written here as Pool A / Pool B (column M)." },
  { id: 14, header: "D01–D14 Shift Time", values: "Military span or RDO", desc: "Fourteen days beginning on the schedule start date. Week 2 repeats the weekly pattern when the session only stored seven days." },
  { id: 28, header: "D01–D14 Shift Type", values: "Airport, Training, Admin/Avail, or blank", desc: "Blank if and only if that day's shift time is RDO. Training lines use Training. Otherwise the selected workday type." },
  { id: 42, header: "RDOs", values: "SU/MO or SU/MO WE/TH", desc: "Weekday abbreviations joined by /. Week 2 is omitted when it matches week 1; otherwise the weeks are separated by a space." },
  { id: 43, header: "Hours/Day", values: "Calculated", desc: "From the typical shift time, including splits. 30 minutes is subtracted when the gross span is 6 hours or more." },
  { id: 44, header: "Hours/PP", values: "Calculated, max 80", desc: "Non-RDO days in the 14-day pattern times Hours/Day, capped at 80." },
  { id: 45, header: "Days/Week", values: "5 or 5/4", desc: "Work days in week 1. If week 2 differs, both counts are shown (5/4)." }
];

export const DAY_ABBR = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

const TITLES = ["Single Group", "TSO", "LTSO", "ETSO", "STSO", "ESTI", "MSTI", "STI", "SSA", "SSTI", "EMT"];
const TITLE_SCAN = ["ESTI", "MSTI", "ETSO", "SSTI", "STSO", "LTSO", "STI", "SSA", "EMT"];
const SHIFT_TYPES = ["Airport", "Training", "Admin/Avail"];
const SPAN_RE = /^(\d{4}-\d{4})( \d{4}-\d{4})?$/;

export function toIsoDate(value) {
  if (!value) return "";
  if (typeof value.toISODate === "function") {
    const iso = value.toISODate();
    if (typeof iso === "string" && /^\d{4}-\d{2}-\d{2}/.test(iso)) return iso.slice(0, 10);
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }
  const s = String(value).trim();
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) return us[3] + "-" + us[1].padStart(2, "0") + "-" + us[2].padStart(2, "0");
  return "";
}

export function addDaysIso(iso, n) {
  const parts = String(iso || "").split("-").map(Number);
  if (parts.length !== 3 || parts.some((x) => !Number.isFinite(x))) return "";
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

export function weekdaySun0(iso) {
  const parts = String(iso || "").split("-").map(Number);
  if (parts.length !== 3 || parts.some((x) => !Number.isFinite(x))) return 0;
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])).getUTCDay();
}

function dowAt(startIso, index) {
  if (startIso && /^\d{4}-\d{2}-\d{2}$/.test(startIso)) return weekdaySun0(addDaysIso(startIso, index));
  return index % 7;
}

export function toHHMM(raw) {
  if (raw == null) return "";
  const s = String(raw).trim().replace(/[\u2013\u2014]/g, "-");
  const hm = s.match(/^(\d{1,2}):(\d{2})$/);
  if (hm) return hm[1].padStart(2, "0") + hm[2];
  const compact = s.match(/^(\d{3,4})$/);
  if (compact) return compact[1].padStart(4, "0");
  return "";
}

export function parseClockLabel(label) {
  if (!label) return [];
  const s = String(label).replace(/[\u2013\u2014]/g, "-").replace(/\s*\/\s*/g, " ");
  const re = /(\d{1,2}:\d{2}|\d{3,4})\s*-\s*(\d{1,2}:\d{2}|\d{3,4})/g;
  const segs = [];
  let m;
  while ((m = re.exec(s))) {
    segs.push({ start: m[1], end: m[2] });
    if (segs.length === 2) break;
  }
  return segs;
}

export function spanFromSegments(segs) {
  if (!segs || !segs.length) return "";
  const parts = [];
  for (let i = 0; i < Math.min(2, segs.length); i++) {
    const a = toHHMM(segs[i] && segs[i].start);
    const b = toHHMM(segs[i] && segs[i].end);
    if (!a || !b) return "";
    parts.push(a + "-" + b);
  }
  return parts.join(" ");
}

export function hoursFromSpan(span) {
  if (!span || span === "RDO" || !SPAN_RE.test(span)) return 0;
  let total = 0;
  span.split(" ").forEach((part) => {
    const bits = part.split("-");
    const s = bits[0];
    const e = bits[1];
    let sMin = parseInt(s.slice(0, 2), 10) * 60 + parseInt(s.slice(2), 10);
    let eMin = parseInt(e.slice(0, 2), 10) * 60 + parseInt(e.slice(2), 10);
    if (eMin < sMin) eMin += 24 * 60;
    total += eMin - sMin;
  });
  const gross = total / 60;
  const net = gross >= 6 ? gross - 0.5 : gross;
  return Math.round(net * 100) / 100;
}

export function formatNum(n) {
  if (!Number.isFinite(n)) return "";
  const r = Math.round(n * 100) / 100;
  return String(r);
}

function scheduleOf(line, schedule) {
  if (!schedule || !line) return null;
  const arr = schedule[line.id] != null ? schedule[line.id] : schedule[String(line.id)];
  return Array.isArray(arr) ? arr : null;
}

function statusAt(line, schedule, index, startIso) {
  if (line && Array.isArray(line._weekdayCells)) {
    const cell = line._weekdayCells[dowAt(startIso, index)];
    return interpretDayCell(cell, "").status;
  }
  const arr = scheduleOf(line, schedule);
  if (arr && arr.length) {
    const src = index < arr.length ? arr[index] : arr[index % arr.length];
    return src === "WORK" ? "WORK" : "RDO";
  }
  const rdo = new Set((line && line.rdoDays ? line.rdoDays : []).map(Number));
  return rdo.has(dowAt(startIso, index)) ? "RDO" : "WORK";
}

export function interpretDayCell(cell, fallbackSpan) {
  const raw = String(cell == null ? "" : cell).trim();
  if (!raw || /^rdo$/i.test(raw) || /^off$/i.test(raw) || raw === "\u2014" || raw === "-") {
    return { status: "RDO", span: "RDO" };
  }
  const segs = parseClockLabel(raw);
  if (segs.length) {
    const span = spanFromSegments(segs);
    return { status: "WORK", span: span || fallbackSpan || "" };
  }
  return { status: "WORK", span: fallbackSpan || "" };
}

function customDaySegments(line, dow) {
  if (!line || !line.dayTimes) return null;
  const custom = line.dayTimes[dow] != null ? line.dayTimes[dow] : line.dayTimes[String(dow)];
  if (!custom || typeof custom !== "object") return null;
  if (Array.isArray(custom.segments) && custom.segments.length >= 2) return custom.segments.slice(0, 2);
  if (custom.start && custom.end) return [{ start: custom.start, end: custom.end }];
  return null;
}

function baseSegments(line, shift) {
  if (shift && Array.isArray(shift.segments) && shift.segments.length >= 2) return shift.segments.slice(0, 2);
  const fromLabel = parseClockLabel(line && line.shiftLabel);
  if (fromLabel.length >= 2) return fromLabel;
  if (line && line.startTime && line.endTime) return [{ start: line.startTime, end: line.endTime }];
  if (shift && shift.start && shift.end) return [{ start: shift.start, end: shift.end }];
  if (fromLabel.length) return fromLabel;
  return [];
}

function segmentsForDay(line, shift, dow, ctx) {
  const custom = customDaySegments(line, dow);
  if (custom) return custom;
  if (ctx && typeof ctx.getEffectiveSegments === "function" && line && line.shiftId) {
    try {
      const segs = ctx.getEffectiveSegments(line.shiftId, dow);
      if (Array.isArray(segs) && segs.length) return segs.slice(0, 2);
    } catch (e) { /* shift helper is optional */ }
  }
  if (shift && shift.dayTimes) {
    const dt = shift.dayTimes[dow] != null ? shift.dayTimes[dow] : shift.dayTimes[String(dow)];
    if (dt && Array.isArray(dt.segments) && dt.segments.length >= 2) return dt.segments.slice(0, 2);
    if (dt && dt.start && dt.end) return [{ start: dt.start, end: dt.end }];
  }
  return baseSegments(line, shift);
}

function resolveShift(line, ctx) {
  if (!line) return null;
  if (ctx && typeof ctx.getShift === "function") {
    const found = ctx.getShift(line.shiftId);
    if (found) return found;
  }
  const shifts = (ctx && ctx.shifts) || [];
  return shifts.find((s) => s && s.id === line.shiftId) || null;
}

export function bidLineIdFromLine(line, index) {
  const code = String((line && line.lineCode) || "").trim();
  if (code) return code;
  const idRaw = line && line.id != null ? String(line.id).trim() : "";
  if (idRaw) return idRaw;
  return String((index || 0) + 1);
}

export function titleFromLine(line) {
  if (!line) return "TSO";
  if (line.isStso) return "STSO";
  if (line.isLtso) return "LTSO";
  const blob = [line.position, line.extraName, line.empClass, line.trainingClass]
    .filter((v) => v != null && String(v).trim() !== "")
    .join(" ");
  if (/single\s*group/i.test(blob)) return "Single Group";
  const upper = blob.toUpperCase();
  for (let i = 0; i < TITLE_SCAN.length; i++) {
    const token = TITLE_SCAN[i];
    if (upper === token || new RegExp("\\b" + token + "\\b").test(upper)) return token;
  }
  return "TSO";
}

export function scheduleTypeFromLine(line) {
  if (!line) return "FT";
  const emp = String(line.empClass || "").trim().toUpperCase();
  const pos = String(line.position || "").trim().toUpperCase();
  if (line.isStso || line.isLtso || emp === "STSO" || emp === "LTSO" || pos === "STSO" || pos === "LTSO") return "FT";
  if (line.isPt === true || emp === "PT" || pos === "PT") return "PT";
  return "FT";
}

export function certificationFromLine(line) {
  const fn = String((line && line.function) || "").trim().toUpperCase();
  if (fn === "BAG" || fn === "BAGS") return { cert: "BAG", defaulted: false, reason: "" };
  if (fn === "DFO" || fn === "DUAL") return { cert: "DUAL", defaulted: false, reason: "" };
  if (fn === "PAX") return { cert: "PAX", defaulted: false, reason: "" };
  if (fn === "TRAINING") {
    return { cert: "PAX", defaulted: true, reason: "TRAINING has no eBid certification; defaulted to PAX" };
  }
  if (!fn || fn === "-") {
    return { cert: "PAX", defaulted: true, reason: "Function is blank; certification defaulted to PAX" };
  }
  return { cert: "PAX", defaulted: true, reason: "Function " + fn + " is not PAX, BAG, or DFO; certification defaulted to PAX" };
}

export function publicCommentFromPool(pool) {
  const raw = String(pool == null ? "" : pool).trim();
  if (!raw) return "";
  const rest = raw.replace(/^pool\s*/i, "").trim();
  const token = (/^pool\b/i.test(raw) ? rest : raw).toUpperCase();
  if (!token) return "";
  return "Pool " + token;
}

export function workgroupFromTeam(name) {
  const raw = String(name || "").trim();
  if (!raw || raw === "\u2014") return "";
  let body = raw;
  if (/^team\b/i.test(body)) body = body.replace(/^team\s*/i, "").trim();
  if (/^\d+$/.test(body)) return ("Team " + String(Number(body)).padStart(2, "0")).slice(0, 30);
  if (/^team\b/i.test(raw)) return ("Team " + body).slice(0, 30);
  return raw.slice(0, 30);
}

export function patDownFromSex(sex) {
  const s = String(sex == null ? "" : sex).trim().toUpperCase();
  if (s === "M" || s === "MALE") return "Male";
  if (s === "F" || s === "FEMALE") return "Female";
  return "None";
}

function teamNameFor(line, ctx) {
  if (!line) return "";
  if (ctx && typeof ctx.teamResolver === "function") {
    const meta = ctx.teamResolver(line.id);
    if (meta && (meta.name || meta.id)) return meta.name || meta.id;
  }
  const teams = (ctx && ctx.teams) || [];
  for (let i = 0; i < teams.length; i++) {
    const members = teams[i] && teams[i].members;
    if (Array.isArray(members) && members.some((m) => String(m) === String(line.id))) {
      return teams[i].name || teams[i].id || "";
    }
  }
  return "";
}

function isTrainingLine(line) {
  if (!line) return false;
  const emp = String(line.empClass || "").toUpperCase();
  const extra = String(line.extraName || "").toUpperCase();
  return !!(line.isTraining || line.trainingClass || line.function === "TRAINING" ||
    emp === "ESTI" || emp === "MSTI" || extra === "ESTI" || extra === "MSTI");
}

function shiftTypeFor(mode, line, workIndex) {
  if (isTrainingLine(line)) return "Training";
  if (mode === "Admin/Avail") return "Admin/Avail";
  if (mode === "Training") return "Training";
  if (mode === "PandemicMix") {
    if (workIndex === 1) return "Admin/Avail";
    if (workIndex === 2) return "Training";
  }
  return "Airport";
}

function rdoString(isRdo, startIso) {
  const w1 = [];
  const w2 = [];
  for (let i = 0; i < 14; i++) {
    if (!isRdo[i]) continue;
    const abbr = DAY_ABBR[dowAt(startIso, i)] || "";
    (i < 7 ? w1 : w2).push(abbr);
  }
  const a = w1.join("/");
  const b = w2.join("/");
  if (a === b) return a;
  return (a + " " + b).trim();
}

export function buildRowFromLine(line, ctx, index) {
  ctx = ctx || {};
  const warnings = [];
  const startIso = toIsoDate(ctx.startDate);
  if (!startIso) warnings.push("Schedule start date is blank; D01 is treated as Sunday.");
  const shift = resolveShift(line, ctx);
  const baseSpan = spanFromSegments(baseSegments(line, shift));
  const dayShiftTimes = [];
  const dayShiftTypes = [];
  const isRdo = [];
  let workCount = 0;
  for (let i = 0; i < 14; i++) {
    const status = statusAt(line, ctx.schedule, i, startIso);
    if (status === "RDO") {
      dayShiftTimes.push("RDO");
      dayShiftTypes.push("");
      isRdo.push(true);
      continue;
    }
    isRdo.push(false);
    const dow = dowAt(startIso, i);
    let span = "";
    if (line && Array.isArray(line._weekdayCells)) {
      span = interpretDayCell(line._weekdayCells[dow], baseSpan).span;
    } else {
      span = spanFromSegments(segmentsForDay(line, shift, dow, ctx)) || baseSpan;
    }
    if (!span) {
      warnings.push("D" + String(i + 1).padStart(2, "0") + " is a work day with no shift time.");
    }
    dayShiftTimes.push(span);
    workCount += 1;
    dayShiftTypes.push(shiftTypeFor(ctx.shiftTypeMode, line, workCount));
  }

  const workSpans = dayShiftTimes.filter((t) => t && t !== "RDO");
  let shiftTime = baseSpan;
  if (workSpans.length) {
    const counts = {};
    workSpans.forEach((s) => { counts[s] = (counts[s] || 0) + 1; });
    shiftTime = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b))[0];
  }
  if (!shiftTime) shiftTime = workSpans.length ? "" : "RDO";

  const dailyHours = hoursFromSpan(shiftTime);
  const totalWork = dayShiftTimes.filter((t) => t !== "RDO").length;
  let hoursPerPP = Math.round(totalWork * dailyHours * 100) / 100;
  let capped = false;
  if (hoursPerPP > 80) {
    hoursPerPP = 80;
    capped = true;
    warnings.push("Hours/PP capped at 80.");
  }
  const w1 = dayShiftTimes.slice(0, 7).filter((t) => t !== "RDO").length;
  const w2 = dayShiftTimes.slice(7).filter((t) => t !== "RDO").length;
  const certInfo = certificationFromLine(line);
  if (certInfo.defaulted && certInfo.reason) warnings.push(certInfo.reason);
  const pool = line && line.certPool != null ? String(line.certPool).trim() : "";
  if (!pool) warnings.push("Cert pool is blank; column 13 (Public Bid Line Comments) is empty.");
  const sexRaw = line && line.sex != null ? String(line.sex).trim() : "";
  if (!sexRaw) warnings.push("Sex is blank; Patdown Req exported as None.");
  const team = workgroupFromTeam(teamNameFor(line, ctx));

  return {
    airportCode: String(ctx.airportCode || "").trim().toUpperCase(),
    bidEventId: String(ctx.bidEventId || "").trim(),
    startDate: startIso,
    endDate: toIsoDate(ctx.endDate),
    bidLineId: bidLineIdFromLine(line, index),
    workgroup: team,
    patDown: patDownFromSex(line && line.sex),
    title: titleFromLine(line),
    certification: certInfo.cert,
    schedType: scheduleTypeFromLine(line),
    shiftTime: shiftTime,
    privateComments: "",
    publicComments: publicCommentFromPool(pool),
    dayShiftTimes: dayShiftTimes,
    dayShiftTypes: dayShiftTypes,
    rdos: rdoString(isRdo, startIso),
    hoursPerDay: dailyHours,
    hoursPerPP: hoursPerPP,
    daysPerWeek: w1 === w2 ? String(w1) : (w1 + "/" + w2),
    capped: capped,
    warnings: warnings,
    sourceId: line && line.id != null ? line.id : ""
  };
}

export function rowToCells(row) {
  return [
    row.airportCode,
    row.bidEventId,
    row.startDate,
    row.endDate,
    row.bidLineId,
    row.workgroup,
    row.patDown,
    row.title,
    row.certification,
    row.schedType,
    row.shiftTime,
    row.privateComments,
    row.publicComments,
    ...row.dayShiftTimes,
    ...row.dayShiftTypes,
    row.rdos,
    formatNum(row.hoursPerDay),
    formatNum(row.hoursPerPP),
    row.daysPerWeek
  ];
}

function sortLines(lines) {
  return (lines || []).slice().sort((a, b) => {
    const na = Number(a && a.id);
    const nb = Number(b && b.id);
    const aNum = Number.isFinite(na);
    const bNum = Number.isFinite(nb);
    if (aNum && bNum && na !== nb) return na - nb;
    if (aNum !== bNum) return aNum ? -1 : 1;
    return String(a && a.id).localeCompare(String(b && b.id));
  });
}

export function rowsFromLines(lines, ctx) {
  return sortLines(lines).filter((line) => line && typeof line === "object").map((line, index) => {
    return buildRowFromLine(line, ctx, index);
  });
}

export function defaultEndDate(startIso) {
  if (!startIso || !/^\d{4}-\d{2}-\d{2}$/.test(startIso)) return "";
  const end = startIso.slice(0, 4) + "-12-31";
  return end < startIso ? startIso : end;
}

export function suggestForm(scheduler) {
  const S = scheduler || {};
  const state = S.state || {};
  const start = toIsoDate(state.startDate);
  let airport = "";
  if (typeof S.getAirportCode === "function") airport = S.getAirportCode() || "";
  if (!airport && state.airportCode) airport = state.airportCode;
  airport = String(airport || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
  const event = airport && start ? (airport + start.slice(0, 7)).slice(0, 10) : "";
  return {
    airportCode: airport,
    bidEventId: event,
    startDate: start,
    endDate: defaultEndDate(start),
    shiftTypeMode: "Airport"
  };
}

function contextFrom(scheduler, form) {
  const S = scheduler || {};
  const state = S.state || {};
  const f = form || {};
  const suggested = suggestForm(S);
  return {
    airportCode: f.airportCode != null ? f.airportCode : suggested.airportCode,
    bidEventId: f.bidEventId != null ? f.bidEventId : suggested.bidEventId,
    startDate: f.startDate != null ? f.startDate : suggested.startDate,
    endDate: f.endDate != null ? f.endDate : suggested.endDate,
    shiftTypeMode: f.shiftTypeMode || "Airport",
    shifts: state.shifts || [],
    schedule: state.schedule || {},
    teams: (S.teams && Array.isArray(S.teams.teams) && S.teams.teams) || state.teams || [],
    getShift: typeof S.getShift === "function" ? function (id) { return S.getShift(id); } : null,
    getEffectiveSegments: typeof S.getEffectiveShiftSegments === "function"
      ? function (id, dow) { return S.getEffectiveShiftSegments(id, dow); }
      : null,
    teamResolver: typeof S.teamMetaForLine === "function" ? S.teamMetaForLine : null
  };
}

export function rowsFromScheduler(scheduler, form) {
  const state = (scheduler && scheduler.state) || {};
  const lines = Array.isArray(state.lines) ? state.lines : [];
  return rowsFromLines(lines, contextFrom(scheduler, form));
}

export function toCsv(rows) {
  const quote = (v) => {
    const str = v == null ? "" : String(v);
    return '"' + str.replace(/"/g, '""') + '"';
  };
  const lines = [EBID_HEADERS.map(quote).join(",")];
  (rows || []).forEach((row) => {
    lines.push(rowToCells(row).map(quote).join(","));
  });
  return lines.join("\r\n");
}

function parseCsvRows(text) {
  const src = String(text || "").replace(/^\uFEFF/, "");
  const lines = src.split(/\r?\n/).filter((l) => l.trim().length > 0);
  return lines.map((line) => {
    const row = [];
    let inside = false;
    let cell = "";
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inside && line[i + 1] === '"') {
          cell += '"';
          i++;
        } else inside = !inside;
      } else if (ch === "," && !inside) {
        row.push(cell.trim());
        cell = "";
      } else cell += ch;
    }
    row.push(cell.trim());
    return row;
  });
}

function headerIndex(headers) {
  const map = {};
  headers.forEach((h, i) => {
    const key = String(h || "").trim().toLowerCase();
    if (key && map[key] == null) map[key] = i;
  });
  return map;
}

function pick(map, names) {
  for (let i = 0; i < names.length; i++) {
    if (map[names[i]] != null) return map[names[i]];
  }
  return -1;
}

export function looksLikeEbidExport(headers) {
  const h = (headers || []).map((x) => String(x || "").trim().toLowerCase());
  return h.indexOf("airport code") !== -1 &&
    h.indexOf("d01 shift time") !== -1 &&
    h.indexOf("public bid line comments") !== -1;
}

function lineFromCsvRecord(rec, index) {
  const rawLine = rec.line || "";
  const stripped = rawLine.replace(/^line\s+/i, "").trim();
  let id = rawLine || (index + 1);
  if (/^\d+$/.test(stripped)) id = Number(stripped);
  const shiftCol = rec.shift || "";
  const label = parseClockLabel(shiftCol).length ? shiftCol : "";
  return {
    id: id,
    lineCode: rawLine || String(id),
    shiftId: "",
    shiftName: label ? "" : shiftCol,
    shiftLabel: label || rec.shiftLabel || "",
    startTime: rec.start || "",
    endTime: rec.end || "",
    position: rec.position || "",
    empClass: rec.emp || "",
    sex: rec.sex || "",
    function: rec.fn || "",
    certPool: rec.certPool || "",
    paid: rec.paid || "",
    isTraining: String(rec.fn || "").toUpperCase() === "TRAINING",
    _weekdayCells: rec.days
  };
}

export function rowsFromCsv(text, form) {
  const table = parseCsvRows(text);
  if (table.length < 2) return { error: "That CSV has no line rows.", rows: [] };
  const headers = table[0];
  if (looksLikeEbidExport(headers)) {
    return {
      error: "That file is already a 45-column eBid export. Build the upload from the live lines instead of re-uploading an old CSV.",
      rows: []
    };
  }
  const map = headerIndex(headers);
  const idx = {
    team: pick(map, ["team", "partner team", "location/workgroup", "workgroup"]),
    line: pick(map, ["line", "line id", "bid line id"]),
    shift: pick(map, ["shift"]),
    start: pick(map, ["start"]),
    end: pick(map, ["end"]),
    position: pick(map, ["position", "title"]),
    emp: pick(map, ["emp", "emp class", "schedule type"]),
    sex: pick(map, ["sex", "gender", "patdown req", "pat down req"]),
    fn: pick(map, ["function", "cert", "certification"]),
    certPool: pick(map, ["cert pool", "certpool", "public bid line comments"]),
    paid: pick(map, ["paid", "hours/day"]),
    sun: pick(map, ["sun"]),
    mon: pick(map, ["mon"]),
    tue: pick(map, ["tue"]),
    wed: pick(map, ["wed"]),
    thu: pick(map, ["thu"]),
    fri: pick(map, ["fri"]),
    sat: pick(map, ["sat"])
  };
  if (idx.line < 0 && idx.position < 0 && idx.sun < 0) {
    return { error: "That CSV is not a lines export (expected Line, Team, Start/End, or Sun–Sat columns).", rows: [] };
  }
  const dayIdx = [idx.sun, idx.mon, idx.tue, idx.wed, idx.thu, idx.fri, idx.sat];
  const lines = [];
  const teams = [];
  for (let r = 1; r < table.length; r++) {
    const row = table[r];
    if (!row || row.every((c) => !String(c || "").trim())) continue;
    const get = (i) => (i >= 0 && row[i] != null ? String(row[i]).trim() : "");
    const rec = {
      team: get(idx.team),
      line: get(idx.line),
      shift: get(idx.shift),
      start: get(idx.start),
      end: get(idx.end),
      position: get(idx.position),
      emp: get(idx.emp),
      sex: get(idx.sex),
      fn: get(idx.fn),
      certPool: get(idx.certPool),
      paid: get(idx.paid),
      days: dayIdx.map(get)
    };
    const line = lineFromCsvRecord(rec, lines.length);
    if (rec.team) teams.push({ id: "t" + r, name: rec.team, members: [line.id] });
    lines.push(line);
  }
  const ctx = Object.assign({}, form || {}, { teams: teams, schedule: {}, shifts: [] });
  return { error: "", rows: rowsFromLines(lines, ctx) };
}

export function rowsFromJsonPayload(data, form) {
  if (!data || typeof data !== "object") return { error: "That JSON is empty.", rows: [] };
  const results = data.results && typeof data.results === "object" ? data.results : data;
  const config = data.config && typeof data.config === "object" ? data.config : {};
  const lines = Array.isArray(results.lines) ? results.lines : (Array.isArray(data.lines) ? data.lines : null);
  if (!lines) return { error: "That JSON has no lines array.", rows: [] };
  const schedule = results.schedule || data.schedule || {};
  const teams = results.teams || data.teams || [];
  const shifts = config.shifts || data.shifts || [];
  const start = (form && form.startDate) || config.startDate || data.startDate || "";
  const ctx = {
    airportCode: form && form.airportCode,
    bidEventId: form && form.bidEventId,
    startDate: start,
    endDate: form && form.endDate,
    shiftTypeMode: (form && form.shiftTypeMode) || "Airport",
    shifts: shifts,
    schedule: schedule,
    teams: teams,
    getShift: function (id) { return (shifts || []).find((s) => s && s.id === id) || null; }
  };
  return { error: "", rows: rowsFromLines(lines, ctx) };
}

function pushIssue(list, level, code, message, lineId) {
  list.push({ level: level, code: code, message: message, lineId: lineId || "" });
}

export function runQa(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const issues = [];
  if (!list.length) {
    return {
      total: 0,
      ft: 0,
      pt: 0,
      male: 0,
      female: 0,
      errors: 0,
      warnings: 0,
      issues: [],
      distinct: {},
      empty: true
    };
  }
  const seen = {};
  let ft = 0;
  let pt = 0;
  let male = 0;
  let female = 0;
  const distinct = {
    "Airport Code": {},
    "Schedule Type": {},
    "Title": {},
    "Patdown Req": {},
    "Certification": {},
    "Public Comments (Cert Pool)": {},
    "Shift Time": {},
    "RDOs": {},
    "Hours/Day": {},
    "Hours/PP": {},
    "Days/Week": {}
  };
  function bump(group, value) {
    const key = value == null || value === "" ? "(blank)" : String(value);
    distinct[group][key] = (distinct[group][key] || 0) + 1;
  }

  list.forEach((row) => {
    const id = row.bidLineId || "(no id)";
    if (row.schedType === "FT") ft += 1;
    else if (row.schedType === "PT") pt += 1;
    if (row.patDown === "Male") male += 1;
    else if (row.patDown === "Female") female += 1;
    bump("Airport Code", row.airportCode);
    bump("Schedule Type", row.schedType);
    bump("Title", row.title);
    bump("Patdown Req", row.patDown);
    bump("Certification", row.certification);
    bump("Public Comments (Cert Pool)", row.publicComments);
    bump("Shift Time", row.shiftTime);
    bump("RDOs", row.rdos);
    bump("Hours/Day", formatNum(row.hoursPerDay));
    bump("Hours/PP", formatNum(row.hoursPerPP));
    bump("Days/Week", row.daysPerWeek);

    if (!/^[A-Z]{3}$/.test(row.airportCode || "")) {
      pushIssue(issues, "error", "airport", "Airport code must be 3 letters.", id);
    }
    if (!row.bidEventId) pushIssue(issues, "error", "event", "Shift Bid Event ID is blank.", id);
    else if (row.bidEventId.length > 100) pushIssue(issues, "error", "event", "Shift Bid Event ID is longer than 100 characters.", id);
    if (!row.startDate) pushIssue(issues, "error", "start", "Schedule start date is blank.", id);
    if (!row.endDate) pushIssue(issues, "error", "end", "Schedule end date is blank.", id);
    else if (row.startDate && row.endDate < row.startDate) {
      pushIssue(issues, "error", "end", "Schedule end date is before the start date.", id);
    }
    if (!row.bidLineId) pushIssue(issues, "error", "line-id", "Bid Line ID is blank.", id);
    else if (String(row.bidLineId).length > 8) pushIssue(issues, "error", "line-id", "Bid Line ID is longer than 8 characters.", id);
    else if (seen[row.bidLineId]) pushIssue(issues, "error", "line-id", "Bid Line ID " + row.bidLineId + " is duplicated.", id);
    if (row.bidLineId) seen[row.bidLineId] = true;
    if (!row.workgroup) pushIssue(issues, "warn", "team", "Location/Workgroup is blank.", id);
    else if (row.workgroup.length > 30) pushIssue(issues, "error", "team", "Location/Workgroup is longer than 30 characters.", id);
    if (["Female", "Male", "None"].indexOf(row.patDown) < 0) {
      pushIssue(issues, "error", "patdown", "Patdown Req must be Female, Male, or None.", id);
    }
    if (TITLES.indexOf(row.title) < 0) pushIssue(issues, "error", "title", "Title " + row.title + " is not an eBid title.", id);
    if (["PAX", "BAG", "DUAL"].indexOf(row.certification) < 0) {
      pushIssue(issues, "error", "cert", "Certification must be PAX, BAG, or DUAL.", id);
    }
    if (row.schedType !== "FT" && row.schedType !== "PT") {
      pushIssue(issues, "error", "sched", "Schedule type must be FT or PT.", id);
    }
    if (row.shiftTime !== "RDO" && !SPAN_RE.test(row.shiftTime || "")) {
      pushIssue(issues, "error", "shift", "Shift time must be 9 or 19 military characters, or RDO.", id);
    }
    if (String(row.privateComments || "").length > 255) {
      pushIssue(issues, "error", "private", "Private comments exceed 255 characters.", id);
    }
    if (String(row.publicComments || "").length > 255) {
      pushIssue(issues, "error", "public", "Public comments exceed 255 characters.", id);
    }
    const times = row.dayShiftTimes || [];
    const types = row.dayShiftTypes || [];
    if (times.length !== 14 || types.length !== 14) {
      pushIssue(issues, "error", "days", "Expected 14 day times and 14 day types.", id);
    }
    for (let d = 0; d < 14; d++) {
      const time = times[d];
      const type = types[d];
      const label = "D" + String(d + 1).padStart(2, "0");
      if (time !== "RDO" && !SPAN_RE.test(time || "")) {
        pushIssue(issues, "error", "day-time", label + " shift time is not RDO or a 9/19-character military span.", id);
      }
      if (time === "RDO" && type) {
        pushIssue(issues, "error", "rdo-type", label + " is RDO but shift type is not blank.", id);
      } else if (time !== "RDO" && !type) {
        pushIssue(issues, "error", "rdo-type", label + " is a work day but shift type is blank.", id);
      } else if (type && SHIFT_TYPES.indexOf(type) < 0) {
        pushIssue(issues, "error", "day-type", label + " shift type " + type + " is not Airport, Training, or Admin/Avail.", id);
      }
    }
    if (Number(row.hoursPerPP) > 80) pushIssue(issues, "error", "hours", "Hours/PP is over 80.", id);
    (row.warnings || []).forEach((msg) => pushIssue(issues, "warn", "line", msg, id));
  });

  const errors = issues.filter((i) => i.level === "error").length;
  const warnings = issues.filter((i) => i.level === "warn").length;
  return {
    total: list.length,
    ft: ft,
    pt: pt,
    male: male,
    female: female,
    errors: errors,
    warnings: warnings,
    issues: issues,
    distinct: distinct,
    empty: false
  };
}
