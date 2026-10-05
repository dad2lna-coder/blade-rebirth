import type {
  ClassOption,
  DfoProposal,
  Headcount,
  ModalUi,
  ScheduleLine,
  SetupSession,
  SexCount,
  ShiftDef,
} from "./types";

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function createModalUi(): ModalUi {
  return {
    activeTargetClass: "",
    activeParityClass: "",
    activeDfoClass: "",
    perShiftTargets: {},
    selectedParityBands: {},
    parityResult: null,
    parityChecked: [],
    dfoResult: null,
    dfoChecked: [],
    revision: 0,
  };
}

export function getModalClassOptions(extraPositions: SetupSession["state"]["extraPositions"] = []): ClassOption[] {
  const options: ClassOption[] = [
    { key: "STSO", label: "STSO" },
    { key: "LTSO", label: "LTSO" },
    { key: "TSO", label: "TSO" },
    { key: "MSTI", label: "MSTI" },
    { key: "ESTI", label: "ESTI" },
  ];

  for (const pos of extraPositions) {
    const name = String(pos.name || pos.id || "Position").trim();
    options.push({ key: "EXTRA_" + pos.id, label: "Extra: " + name });
  }

  return options;
}

function fallbackClass(options: ClassOption[]): string {
  return options[0]?.key ?? "STSO";
}

function ensureClass(current: string, options: ClassOption[]): string {
  if (current && options.some((opt) => opt.key === current)) return current;
  return fallbackClass(options);
}

export function isTrainingClass(classKey: string): boolean {
  return classKey === "MSTI" || classKey === "ESTI";
}

/** Band key from the shift, or its crew group. Not a scheduler. */
export function getBandKey(session: SetupSession, shiftId: string): string {
  const shifts = session.state.shifts || [];
  const shift = shifts.find((item) => item.id === shiftId);
  if (!shift) return shiftId || "default";
  if (shift.crewGroupId) return "crew_" + shift.crewGroupId;
  const groups = session.state.shiftCrewGroups || [];
  const group = groups.find((item) => item.shiftIds && item.shiftIds.indexOf(shiftId) !== -1);
  if (group) return "crew_" + group.id;
  return shiftId;
}

export function getBandLabel(session: SetupSession, bandKey: string): string {
  if (bandKey.indexOf("crew_") === 0) {
    const cgId = bandKey.substring(5);
    const groups = session.state.shiftCrewGroups || [];
    const grp = groups.find((item) => item.id === cgId);
    if (grp) return "Group: " + (grp.name || grp.id);
  }
  const shifts = session.state.shifts || [];
  const shift = shifts.find((item) => item.id === bandKey);
  if (shift) {
    return (shift.name || shift.id) + (shift.start ? " (" + shift.start + "–" + shift.end + ")" : "");
  }
  return bandKey;
}

export function formatRdos(rdoDays: number[] | undefined): string {
  if (!Array.isArray(rdoDays) || !rdoDays.length) return "None";
  const sorted = rdoDays.slice().map(Number).sort((a, b) => a - b);
  return sorted.map((day) => DAYS_SHORT[day] || String(day)).join("-");
}

function bandKeysFor(session: SetupSession): string[] {
  const keys: string[] = [];
  const seen: Record<string, boolean> = {};
  for (const shift of session.state.shifts || []) {
    const key = getBandKey(session, shift.id);
    if (!seen[key]) {
      seen[key] = true;
      keys.push(key);
    }
  }
  return keys;
}

export function primeModal(session: SetupSession, ui: ModalUi) {
  const options = getModalClassOptions(session.state.extraPositions);
  const fallback = fallbackClass(options);
  if (!ui.activeTargetClass) ui.activeTargetClass = fallback;
  if (!ui.activeParityClass) ui.activeParityClass = fallback;
  if (!ui.activeDfoClass) ui.activeDfoClass = fallback;
  initPerShiftTargetsForClass(session, ui, ui.activeTargetClass);
  ensureParityBands(session, ui);
  ui.revision++;
}

export function initPerShiftTargetsForClass(
  session: SetupSession,
  ui: ModalUi,
  classKey: string,
): Record<string, SexCount> {
  const existing = ui.perShiftTargets[classKey];
  if (existing) return existing;

  const shifts = session.state.shifts || [];
  const targets: Record<string, SexCount> = {};
  for (const shift of shifts) targets[shift.id] = { M: 0, F: 0 };

  const lines = (session.state.lines || []).filter((line) =>
    session.belongsToClass ? session.belongsToClass(line, classKey) : false,
  );

  if (lines.length) {
    for (const line of lines) {
      if (!line.shiftId || !targets[line.shiftId]) continue;
      if (line.isShortfall) continue;
      if (line.sex === "F") targets[line.shiftId].F++;
      else targets[line.shiftId].M++;
    }
  } else if (shifts.length > 0) {
    const hc = session.getClassHeadcount
      ? session.getClassHeadcount(classKey)
      : { M: 0, F: 0, total: 0 };
    if (isTrainingClass(classKey)) {
      let remTrain = hc.total;
      for (let index = 0; index < shifts.length; index++) {
        const take = Math.floor(remTrain / (shifts.length - index));
        targets[shifts[index].id].M = take;
        remTrain -= take;
      }
    } else {
      let male = hc.M;
      let female = hc.F;
      for (let index = 0; index < shifts.length; index++) {
        const takeM = Math.floor(male / (shifts.length - index));
        const takeF = Math.floor(female / (shifts.length - index));
        targets[shifts[index].id].M = takeM;
        targets[shifts[index].id].F = takeF;
        male -= takeM;
        female -= takeF;
      }
    }
  }

  ui.perShiftTargets[classKey] = targets;
  return targets;
}

export function ensureParityBands(session: SetupSession, ui: ModalUi) {
  for (const key of bandKeysFor(session)) {
    if (ui.selectedParityBands[key] === undefined) ui.selectedParityBands[key] = true;
  }
}

export type TargetRow = {
  shiftId: string;
  name: string;
  time: string;
  male: number;
  female: number;
  total: number;
  maleUp: boolean;
  femaleUp: boolean;
  totalUp: boolean;
  sexLocked: boolean;
};

export type TargetModel = {
  classKey: string;
  options: ClassOption[];
  info: string;
  rows: TargetRow[];
};

function sumsFor(shifts: ShiftDef[], targets: Record<string, SexCount>) {
  let sumM = 0;
  let sumF = 0;
  for (const shift of shifts) {
    const count = targets[shift.id] || { M: 0, F: 0 };
    sumM += +count.M || 0;
    sumF += +count.F || 0;
  }
  return { sumM, sumF };
}

export function targetModel(session: SetupSession, ui: ModalUi): TargetModel {
  const options = getModalClassOptions(session.state.extraPositions);
  const classKey = ensureClass(ui.activeTargetClass, options);
  const hc: Headcount = session.getClassHeadcount
    ? session.getClassHeadcount(classKey)
    : { M: 0, F: 0, total: 0 };
  const targets = ui.perShiftTargets[classKey] || {};
  const shifts = session.state.shifts || [];
  const { sumM, sumF } = sumsFor(shifts, targets);
  const training = isTrainingClass(classKey);
  const info = training
    ? "Total: " +
      (sumM + sumF) +
      " / " +
      hc.total +
      " targeted (" +
      Math.max(0, hc.total - (sumM + sumF)) +
      " shortfall)"
    : "Male: " +
      sumM +
      " / " +
      hc.M +
      " (" +
      Math.max(0, hc.M - sumM) +
      " shortfall) | Female: " +
      sumF +
      " / " +
      hc.F +
      " (" +
      Math.max(0, hc.F - sumF) +
      " shortfall)";

  const rows: TargetRow[] = shifts.map((shift) => {
    const count = targets[shift.id] || { M: 0, F: 0 };
    const male = +count.M || 0;
    const female = +count.F || 0;
    const canIncM = !training && sumM < hc.M;
    const canIncF = !training && sumF < hc.F;
    return {
      shiftId: shift.id,
      name: shift.name || shift.id,
      time: (shift.start || "") + (shift.end ? "–" + shift.end : ""),
      male,
      female,
      total: male + female,
      maleUp: canIncM,
      femaleUp: canIncF,
      totalUp: training ? sumM + sumF < hc.total : canIncM || canIncF,
      sexLocked: training,
    };
  });

  return { classKey, options, info, rows };
}

export type TargetNudge = "m-up" | "m-down" | "f-up" | "f-down" | "tot-up" | "tot-down";

export function adjustTarget(session: SetupSession, ui: ModalUi, shiftId: string, kind: TargetNudge) {
  const options = getModalClassOptions(session.state.extraPositions);
  const classKey = ensureClass(ui.activeTargetClass, options);
  ui.activeTargetClass = classKey;
  const targets = initPerShiftTargetsForClass(session, ui, classKey);
  const row = targets[shiftId];
  if (!row) return;

  const hc = session.getClassHeadcount
    ? session.getClassHeadcount(classKey)
    : { M: 0, F: 0, total: 0 };
  const { sumM, sumF } = sumsFor(session.state.shifts || [], targets);
  const training = isTrainingClass(classKey);

  if (kind === "m-up") {
    if (sumM < hc.M) row.M++;
  } else if (kind === "m-down") {
    if (row.M > 0) row.M--;
  } else if (kind === "f-up") {
    if (sumF < hc.F) row.F++;
  } else if (kind === "f-down") {
    if (row.F > 0) row.F--;
  } else if (kind === "tot-up") {
    if (training) {
      if (sumM + sumF < hc.total) row.M++;
    } else if (sumM < hc.M) row.M++;
    else if (sumF < hc.F) row.F++;
  } else if (row.F > 0) row.F--;
  else if (row.M > 0) row.M--;

  ui.revision++;
}

export function selectTargetClass(session: SetupSession, ui: ModalUi, classKey: string) {
  const options = getModalClassOptions(session.state.extraPositions);
  ui.activeTargetClass = ensureClass(classKey, options);
  initPerShiftTargetsForClass(session, ui, ui.activeTargetClass);
  ui.revision++;
}

export function generateAll(session: SetupSession, ui: ModalUi) {
  session.generate();
  ui.revision++;
}

export function generateOneClass(session: SetupSession, ui: ModalUi, classKey: string) {
  const targets = (ui.perShiftTargets && ui.perShiftTargets[classKey]) || null;
  session.generateClass(classKey, targets);
  ui.revision++;
}

function parseStart(value: string | null | undefined): Date {
  if (value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
    if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function addDays(date: Date, count: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + count);
  return next;
}

export type BandRow = { label: string; cells: string[] };

export function weekdayBands(session: SetupSession): { empty: true } | { empty: false; rows: BandRow[] } {
  const lines = session.state.lines || [];
  const shifts = session.state.shifts || [];
  if (!lines.length || !shifts.length) return { empty: true };

  const base = parseStart(session.state.startDate);
  const keys = bandKeysFor(session);
  const seen: Record<string, boolean> = {};
  for (const key of keys) seen[key] = true;

  const counts: Record<string, { M: number; F: number; total: number }[]> = {};
  for (const key of keys) {
    counts[key] = [];
    for (let day = 0; day < 7; day++) counts[key][day] = { M: 0, F: 0, total: 0 };
  }

  for (const line of lines) {
    if (!line || !line.shiftId) continue;
    if (line.isShortfall || line.function === "-") continue;
    const key = getBandKey(session, line.shiftId);
    if (!counts[key]) {
      counts[key] = [];
      for (let day = 0; day < 7; day++) counts[key][day] = { M: 0, F: 0, total: 0 };
      keys.push(key);
      seen[key] = true;
    }
    const lineSchedule = session.state.schedule[line.id] || session.state.schedule[String(line.id)] || [];
    const rotation =
      session.state.functionRotation[line.id] || session.state.functionRotation[String(line.id)] || null;
    for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
      if (lineSchedule[dayIdx] !== "WORK") continue;
      const duty = rotation ? rotation[dayIdx] : line.function;
      if (duty === "-") continue;
      const calDow = addDays(base, dayIdx).getDay();
      counts[key][calDow].total++;
      if (line.sex === "F") counts[key][calDow].F++;
      else if (line.sex === "M") counts[key][calDow].M++;
    }
  }

  return {
    empty: false,
    rows: keys.map((key) => ({
      label: getBandLabel(session, key),
      cells: counts[key].map((cell) => cell.M + "M / " + cell.F + "F (" + cell.total + ")"),
    })),
  };
}

export type ParityBand = { key: string; label: string; checked: boolean };

export function parityBands(session: SetupSession, ui: ModalUi): ParityBand[] {
  return bandKeysFor(session).map((key) => ({
    key,
    label: getBandLabel(session, key),
    checked: ui.selectedParityBands[key] !== false,
  }));
}

export function selectParityClass(ui: ModalUi, classKey: string) {
  ui.activeParityClass = classKey;
  ui.parityResult = null;
  ui.parityChecked = [];
  ui.revision++;
}

export function toggleParityBand(ui: ModalUi, bandKey: string, checked: boolean) {
  ui.selectedParityBands[bandKey] = checked;
  ui.parityResult = null;
  ui.parityChecked = [];
  ui.revision++;
}

function selectedBands(ui: ModalUi): string[] {
  const bands: string[] = [];
  for (const key of Object.keys(ui.selectedParityBands)) {
    if (ui.selectedParityBands[key]) bands.push(key);
  }
  return bands;
}

export function runParityCheck(session: SetupSession, ui: ModalUi) {
  const options = getModalClassOptions(session.state.extraPositions);
  const classKey = ensureClass(ui.activeParityClass, options);
  ui.activeParityClass = classKey;
  ui.parityResult = session.checkParity(classKey, selectedBands(ui));
  ui.parityChecked = (ui.parityResult.proposals || []).map(() => true);
  ui.revision++;
}

export function setParityChecked(ui: ModalUi, index: number, checked: boolean) {
  const next = ui.parityChecked.slice();
  next[index] = checked;
  ui.parityChecked = next;
  ui.revision++;
}

export function approveParity(session: SetupSession, ui: ModalUi) {
  const proposals = ui.parityResult?.proposals || [];
  const pairs = proposals.flatMap((proposal, index) => {
    if (ui.parityChecked[index] === false) return [];
    return [
      {
        lineAId: String(proposal.lineA.id),
        lineBId: String(proposal.lineB.id),
        rdoA_after: proposal.rdoA_after,
        rdoB_after: proposal.rdoB_after,
      },
    ];
  });

  if (pairs.length) {
    session.approveParitySwaps(pairs);
    const classKey = ui.activeParityClass || "STSO";
    ui.parityResult = session.checkParity(classKey, selectedBands(ui));
    ui.parityChecked = (ui.parityResult.proposals || []).map(() => true);
  }
  ui.revision++;
}

export function selectDfoClass(ui: ModalUi, classKey: string) {
  ui.activeDfoClass = classKey;
  ui.dfoResult = null;
  ui.dfoChecked = [];
  ui.revision++;
}

export function runDfoPropose(session: SetupSession, ui: ModalUi) {
  const options = getModalClassOptions(session.state.extraPositions);
  const classKey = ensureClass(ui.activeDfoClass, options);
  ui.activeDfoClass = classKey;
  ui.dfoResult = session.proposeDfoCertBalance(classKey);
  ui.dfoChecked = (ui.dfoResult.proposals || []).map(() => true);
  ui.revision++;
}

export function setDfoChecked(ui: ModalUi, index: number, checked: boolean) {
  const next = ui.dfoChecked.slice();
  next[index] = checked;
  ui.dfoChecked = next;
  ui.revision++;
}

export function approveDfo(session: SetupSession, ui: ModalUi) {
  const result = ui.dfoResult;
  if (!result) return;

  const selected: DfoProposal[] = [];
  if (result.mode === "cert_move") {
    (result.proposals || []).forEach((proposal, index) => {
      if (ui.dfoChecked[index] !== false) selected.push(proposal);
    });
  }

  session.approveDfoCertBalance(result, selected);
  const classKey = ui.activeDfoClass || "STSO";
  ui.dfoResult = session.proposeDfoCertBalance(classKey);
  ui.dfoChecked = (ui.dfoResult.proposals || []).map(() => true);
  ui.revision++;
}

export function parityClassKey(session: SetupSession, ui: ModalUi): string {
  return ensureClass(ui.activeParityClass, getModalClassOptions(session.state.extraPositions));
}

export function dfoClassKey(session: SetupSession, ui: ModalUi): string {
  return ensureClass(ui.activeDfoClass, getModalClassOptions(session.state.extraPositions));
}

export function lineLabel(line: ScheduleLine): string {
  return String(line.lineCode || line.id);
}
