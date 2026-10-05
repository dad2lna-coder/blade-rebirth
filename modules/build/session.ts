import type { SetupSession } from "./types";
import { attachGenerate } from "./actions/generate.js";
import { attachAllocation } from "./actions/allocation.js";
import { attachFunctionCoverage } from "./function-coverage/attach.js";
import { attachSetupState } from "./stores/setupStore.js";
import { attachCertPools } from "./certs/certs.js";
import { attachClassGenerate } from "./actions/classGenerate.js";
import { buildExtraPositionLines, lineInOpsCoverage, opsFteYes } from "./fte/extraPositions.js";
import { attachTrainingClasses } from "./fte/trainingClasses.js";
import { attachShiftMath } from "./shifts/shiftMath.js";
import { isValidTimeText, timeToMin } from "./shifts/time.js";

/**
 * Setup session. Generate and single-class generate run Alpha's engine.
 * Parity and DFO cert approve stay stubs.
 * The Build form writes period, seed, FTE, coverage, certs, and shifts here.
 */
export function createEmptySession(): SetupSession {
  const session: SetupSession & Record<string, unknown> = {
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

  session.BADGES = ["badge-open", "badge-am", "badge-pm", "badge-close", "badge-4x10"];
  session.timeToMin = timeToMin;
  session.isValidTimeText = isValidTimeText;
  session.teams = { teams: [] };

  attachSetupState(session);
  attachShiftMath(session);
  attachAllocation(session);
  attachTrainingClasses(session);
  attachCertPools(session);
  attachFunctionCoverage(session);
  session.opsFteYes = opsFteYes;
  session.lineInOpsCoverage = lineInOpsCoverage;
  session.buildExtraPositionLines = () => buildExtraPositionLines(session);
  attachGenerate(session);
  attachClassGenerate(session);

  return session;
}

/** The session Build already mounts. Ship reads this — it does not keep lines. */
export const session = createEmptySession();
