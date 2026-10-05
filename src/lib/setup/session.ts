import type { SetupSession } from "./types";

/** Empty setup session. Generate, parity, and cert actions are no-ops until a later slice. */
export function createEmptySession(): SetupSession {
  return {
    state: {
      startDate: null,
      extraPositions: [],
      shifts: [],
      lines: [],
      schedule: {},
      functionRotation: {},
      shiftCrewGroups: [],
    },
    belongsToClass: () => false,
    getClassHeadcount: () => ({ M: 0, F: 0, total: 0 }),
    generateClass: () => {},
    generate: () => {},
    checkParity: () => ({ summary: "", proposals: [] }),
    approveParitySwaps: () => {},
    proposeDfoCertBalance: () => ({ summary: "", proposals: [], mode: "cert_move" }),
    approveDfoCertBalance: () => {},
  };
}
