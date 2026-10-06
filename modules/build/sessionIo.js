// @ts-nocheck
/** Session JSON import / export / clear. Ports the legacy setup-panel envelope. Not a second store. */
import { notifySessionLines } from "./sessionBus.js";
import { defaultFunctionCoverage, defaultSetupState, defaultShifts, setupStore } from "./stores/setupStore.js";
import { ensurePositionGender } from "./fte/gender.js";
import { normalizeCertPoolConfig } from "./certs/certs.js";
import { isValidTimeText, safeNumber } from "./shifts/time.js";
import { parseStartDate, toDateInputValue } from "./period/dates.js";

function clone(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function floorCount(value) {
  return Math.floor(safeNumber(value, 0, 0, null));
}

function dateStamp(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  try {
    const formatted = toDateInputValue(value);
    if (formatted && formatted !== "Invalid DateTime") return formatted;
  } catch (err) {
    /* luxon missing — fall through */
  }
  return null;
}

function normalizeLine(raw) {
  if (!raw || typeof raw !== "object" || raw.id == null) return null;
  const extraId = raw.extraPositionId == null ? "" : String(raw.extraPositionId);
  const extraName = raw.extraName == null ? "" : String(raw.extraName);
  const isExtra = Boolean(raw.isExtra || extraId);
  let opsFte;
  if (raw.opsFte !== undefined && raw.opsFte !== null) {
    opsFte = raw.opsFte === true || raw.opsFte === 1 || String(raw.opsFte).toLowerCase() === "yes" || String(raw.opsFte).toLowerCase() === "true";
  } else if (isExtra || raw.isTraining) {
    opsFte = false;
  } else {
    opsFte = true;
  }
  const fn = raw.function;
  const line = Object.assign({}, raw, {
    id: raw.id,
    lineCode: raw.lineCode || ("Line " + String(raw.id).padStart(3, "0")),
    shiftId: raw.shiftId || "",
    shiftName: raw.shiftName || "",
    empClass: raw.empClass || "",
    position: raw.position || raw.extraName || raw.empClass || "",
    isLtso: Boolean(raw.isLtso),
    isStso: Boolean(raw.isStso),
    isExtra: isExtra,
    extraPositionId: extraId,
    extraName: extraName || (isExtra ? (raw.position || raw.empClass || "") : ""),
    opsFte: opsFte,
    sex: raw.sex === "F" ? "F" : "M",
    function: fn === "DFO" || fn === "PAX" || fn === "BAG" || fn === "TRAINING" || fn === "-" ? fn : "",
    certPool: raw.certPool == null ? "" : String(raw.certPool).trim(),
    rdoDays: Array.isArray(raw.rdoDays) ? raw.rdoDays.map(Number).filter(function (day) {
      return Number.isInteger(day) && day >= 0 && day <= 6;
    }) : [],
    rdoHard: Boolean(raw.rdoHard),
    paid: safeNumber(raw.paid, 8, 1, 24),
  });
  return line;
}

function normalizeSchedule(rawSchedule, lineIds) {
  const out = {};
  const source = rawSchedule && typeof rawSchedule === "object" ? rawSchedule : {};
  lineIds.forEach(function (id) {
    const arr = Array.isArray(source[id]) ? source[id] : (Array.isArray(source[String(id)]) ? source[String(id)] : []);
    out[id] = arr.map(function (cell) { return cell === "WORK" ? "WORK" : "RDO"; });
  });
  return out;
}

function syncShiftSeq(session) {
  const shifts = (session.state && session.state.shifts) || [];
  let max = shifts.length;
  shifts.forEach(function (shift) {
    const n = Number(String(shift && shift.id || "").replace(/\D/g, ""));
    if (Number.isFinite(n)) max = Math.max(max, n);
  });
  session.shiftSeq = max + 1;
}

function mirrorStore(session) {
  const state = session.state || {};
  setupStore.fte = {
    ftM: state.ftM, ftF: state.ftF, ptM: state.ptM, ptF: state.ptF,
    ptHoursPerDay: state.ptHoursPerDay, ptDaysPerWeek: state.ptDaysPerWeek,
    ltsoM: state.ltsoM, ltsoF: state.ltsoF, stsoM: state.stsoM, stsoF: state.stsoF,
    esti: state.esti, msti: state.msti,
  };
  setupStore.period = {
    open: state.open,
    close: state.close,
    weeks: state.weekCount,
    start: dateStamp(state.startDate),
    seed: state.generateSeed,
  };
  setupStore.extraPositions = state.extraPositions;
  setupStore.functionCoverage = state.functionCoverage;
  setupStore.certPool = state.certPool;
}

export function sessionPayload(session) {
  const state = (session && session.state) || {};
  const startDateValue = dateStamp(state.startDate);
  return {
    app: "scheduler-pre-v2",
    version: 5,
    exportedAt: new Date().toISOString(),
    config: {
      open: state.open,
      close: state.close,
      startDate: startDateValue,
      weekCount: state.weekCount,
      generateSeed: state.generateSeed || "random",
      useDynamicHours: !!state.useDynamicHours,
      dayHours: state.dayHours || null,
      ftM: state.ftM, ftF: state.ftF,
      ptM: state.ptM, ptF: state.ptF,
      ptHoursPerDay: state.ptHoursPerDay,
      ptDaysPerWeek: state.ptDaysPerWeek,
      ltsoM: state.ltsoM, ltsoF: state.ltsoF,
      stsoM: state.stsoM, stsoF: state.stsoF,
      esti: state.esti, msti: state.msti,
      positionGender: state.positionGender || null,
      certDfoMax: state.certDfoMax, certPaxMax: state.certPaxMax, certBagMax: state.certBagMax,
      certDfoEnabled: state.certDfoEnabled, certBagEnabled: state.certBagEnabled,
      shifts: state.shifts,
      shiftCrewGroups: state.shiftCrewGroups || [],
      scheduleLocks: state.scheduleLocks || [],
      functionCoverage: state.functionCoverage || null,
      extraPositions: state.extraPositions || [],
      certPool: state.certPool || null,
    },
    results: {
      lines: state.lines || [],
      schedule: state.schedule || {},
      mode: state.mode,
      issues: state.issues || [],
      functionRotation: state.functionRotation || {},
      activeSeed: state.activeSeed,
      teams: (session && session.teams && session.teams.teams) || [],
    },
  };
}

export function exportSession(session) {
  const payload = sessionPayload(session);
  const startDateValue = payload.config.startDate;
  const filename = "scheduler-pre-v5-export-" + (startDateValue || "export") + ".json";
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return filename;
}

export function applySession(session, payload) {
  if (!session) throw new Error("No session.");
  if (!payload || typeof payload !== "object") throw new Error("Invalid JSON payload.");
  const root = payload.state && typeof payload.state === "object" && !payload.config ? payload.state : payload;
  const cfg = payload.config || payload.legacy || root;
  const results = payload.results || payload.legacy || root;
  const fresh = defaultSetupState();
  const state = session.state || (session.state = {});

  state.open = isValidTimeText(cfg.open) ? cfg.open : fresh.open;
  state.close = isValidTimeText(cfg.close) ? cfg.close : fresh.close;
  state.useDynamicHours = !!cfg.useDynamicHours;
  if (Array.isArray(cfg.dayHours) && cfg.dayHours.length === 7) {
    state.dayHours = cfg.dayHours.map(function (day) {
      return {
        open: isValidTimeText(day && day.open) ? day.open : state.open,
        close: isValidTimeText(day && day.close) ? day.close : state.close,
      };
    });
  } else {
    state.dayHours = null;
  }
  state.weekCount = Math.floor(safeNumber(cfg.weekCount, 1, 1, 8));
  state.ftM = floorCount(cfg.ftM);
  state.ftF = floorCount(cfg.ftF);
  state.ptM = floorCount(cfg.ptM);
  state.ptF = floorCount(cfg.ptF);
  state.ptHoursPerDay = Math.floor(safeNumber(cfg.ptHoursPerDay, fresh.ptHoursPerDay, 1, 12));
  state.ptDaysPerWeek = Math.floor(safeNumber(cfg.ptDaysPerWeek, fresh.ptDaysPerWeek, 1, 6));
  state.ltsoM = floorCount(cfg.ltsoM);
  state.ltsoF = floorCount(cfg.ltsoF);
  state.stsoM = floorCount(cfg.stsoM);
  state.stsoF = floorCount(cfg.stsoF);
  state.esti = floorCount(cfg.esti);
  state.msti = floorCount(cfg.msti);
  state.startDate = parseStartDate(cfg.startDate || payload.startDate || null);
  state.generateSeed = cfg.generateSeed || payload.generateSeed || "random";
  state.shifts = Array.isArray(cfg.shifts) && cfg.shifts.length ? cfg.shifts.map(clone) : defaultShifts();
  state.shiftCrewGroups = Array.isArray(cfg.shiftCrewGroups) ? cfg.shiftCrewGroups.map(clone) : [];
  state.scheduleLocks = Array.isArray(cfg.scheduleLocks) ? cfg.scheduleLocks.map(clone) : [];
  state.functionCoverage = Object.assign(defaultFunctionCoverage(), clone(cfg.functionCoverage) || {});
  if (!Array.isArray(state.functionCoverage.requirementShiftIds)) state.functionCoverage.requirementShiftIds = [];
  if (state.functionCoverage.poolTsoDfoPt == null) state.functionCoverage.poolTsoDfoPt = 0;
  state.certPool = normalizeCertPoolConfig(cfg.certPool || payload.certPool);
  state.certDfoMax = floorCount(cfg.certDfoMax);
  state.certPaxMax = floorCount(cfg.certPaxMax);
  state.certBagMax = floorCount(cfg.certBagMax);
  state.certDfoEnabled = cfg.certDfoEnabled != null ? !!cfg.certDfoEnabled : fresh.certDfoEnabled;
  state.certBagEnabled = cfg.certBagEnabled != null ? !!cfg.certBagEnabled : fresh.certBagEnabled;
  state.extraPositions = Array.isArray(cfg.extraPositions) ? cfg.extraPositions.map(clone) : [];
  state.positionGender = cfg.positionGender && typeof cfg.positionGender === "object"
    ? clone(cfg.positionGender)
    : clone(fresh.positionGender);
  ensurePositionGender(state);
  state.lines = Array.isArray(results.lines) ? results.lines.map(normalizeLine).filter(Boolean) : [];
  state.schedule = normalizeSchedule(results.schedule, state.lines.map(function (line) { return line.id; }));
  state.functionRotation = results.functionRotation && typeof results.functionRotation === "object"
    ? clone(results.functionRotation)
    : {};
  state.mode = typeof results.mode === "string" ? results.mode : "imported";
  state.issues = Array.isArray(results.issues) ? results.issues.map(String) : [];
  state.activeSeed = results.activeSeed != null ? results.activeSeed : state.generateSeed;
  if (session.teams) {
    session.teams.teams = Array.isArray(results.teams) ? results.teams.map(clone) : [];
  }
  syncShiftSeq(session);
  mirrorStore(session);
  notifySessionLines();
  return session;
}

export function clearSession(session) {
  if (!session) return session;
  const fresh = defaultSetupState();
  const state = session.state || (session.state = {});
  Object.keys(state).forEach(function (key) { delete state[key]; });
  Object.assign(state, fresh);
  state.startDate = parseStartDate(null);
  ensurePositionGender(state);
  if (session.teams) session.teams.teams = [];
  syncShiftSeq(session);
  mirrorStore(session);
  notifySessionLines();
  return session;
}
