// @ts-nocheck
/** Setup owns default hours, FTE, shifts, function-coverage seed. */

export function defaultShifts() {
  return [
    { id: "S1", name: "0330", start: "03:30", end: "12:00", paid: 8, force: 0, ltsoForce: 0, stsoForce: 0, rdoHard: [] },
    { id: "S2", name: "0400", start: "04:00", end: "12:30", paid: 8, force: 0, ltsoForce: 0, stsoForce: 0, rdoHard: [] },
    { id: "S3", name: "1230", start: "12:00", end: "20:30", paid: 8, force: 0, ltsoForce: 0, stsoForce: 0, rdoHard: [] },
    { id: "S4", name: "1430", start: "14:30", end: "23:00", paid: 8, force: 0, ltsoForce: 0, stsoForce: 0, rdoHard: [] },
    { id: "S5", name: "4\u00d710", start: "10:30", end: "20:00", paid: 10, force: 0, ltsoForce: 0, stsoForce: 0, rdoHard: [2, 3, 6] }
  ];
}

export function defaultFunctionCoverage() {
  return {
    mode: "none",
    poolStsoDfoM: 0, poolStsoDfoF: 0,
    poolLtsoDfoM: 0, poolLtsoDfoF: 0,
    poolTsoDfoM: 0, poolTsoDfoF: 0,
    poolStsoBagM: 0, poolStsoBagF: 0,
    poolLtsoBagM: 0, poolLtsoBagF: 0,
    poolTsoBagM: 0, poolTsoBagF: 0,
    poolStsoDfo: 0, poolLtsoDfo: 0, poolTsoDfo: 0, poolBag: 0,
    amPmSplit: true,
    phaseThresholdMin: 15,
    bias: "none",
    requirements: { STSO: {}, LTSO: {}, TSO: {} },
    requirementShiftIds: []
  };
}

export function defaultSetupState() {
  return {
    open: "03:30",
    close: "23:00",
    useDynamicHours: false,
    dayHours: null,
    startDate: null,
    weekCount: 1,
    ftM: 10, ftF: 10,
    ptM: 4, ptF: 4,
    ptHoursPerDay: 4,
    ptDaysPerWeek: 3,
    ltsoM: 1, ltsoF: 1,
    stsoM: 2, stsoF: 2,
    esti: 0, msti: 0,
    certDfoMax: 0, certPaxMax: 0, certBagMax: 0,
    certDfoEnabled: true, certBagEnabled: true,
    certPool: { pools: ["A", "B"], targetBPercent: 45, functionMap: { DFO: "B", BAG: "", PAX: "" } },
    functionRotation: {},
    functionCoverage: defaultFunctionCoverage(),
    shifts: defaultShifts(),
    shiftCrewGroups: [],
    scheduleLocks: [],
    lines: [],
    schedule: {},
    extraPositions: [],
    issues: [],
    mode: "\u2014"
  };
}

export const setupStore = {
  fte: null,
  period: null,
  extraPositions: null,
  functionCoverage: null
};

export function attachSetupState(S) {
  if (!S) return;
  if (!S.state) S.state = {};
  var seed = defaultSetupState();
  Object.keys(seed).forEach(function (k) {
    if (S.state[k] == null) S.state[k] = seed[k];
  });
  if (!Array.isArray(S.state.shifts) || !S.state.shifts.length) {
    S.state.shifts = defaultShifts();
  }
  if (!S.state.functionCoverage) S.state.functionCoverage = defaultFunctionCoverage();
  if (!S.state.certPool) {
    S.state.certPool = { pools: ["A", "B"], targetBPercent: 45, functionMap: { DFO: "B", BAG: "", PAX: "" } };
  }
  if (!Array.isArray(S.state.shiftCrewGroups)) S.state.shiftCrewGroups = [];
  if (!Array.isArray(S.state.scheduleLocks)) S.state.scheduleLocks = [];
  S.defaultShifts = defaultShifts;
  if (!S.shiftSeq) S.shiftSeq = (S.state.shifts && S.state.shifts.length) || 6;
}
