import type { SetupSession } from "./types";
import { attachGenerate } from "./actions/generate.js";
import { attachAllocation } from "./actions/allocation.js";
import { attachSetupState } from "./stores/setupStore.js";
import { attachCertPools } from "./utils/certs.js";
import { attachClassGenerate } from "./utils/classGenerate.js";
import { buildExtraPositionLines, lineInOpsCoverage, opsFteYes } from "./utils/extraPositions.js";
import { attachShiftMath } from "./utils/shiftMath.js";
import { isValidTimeText, timeToMin } from "./utils/time.js";
import { attachTrainingClasses } from "./utils/trainingClasses.js";

/**
 * Setup session. Generate and single-class generate run Alpha's engine.
 * Parity and DFO cert approve stay stubs.
 * FTE, hours, and shifts are Alpha's defaults — the setup form is not ported,
 * and generate cannot build lines without them.
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
  session.opsFteYes = opsFteYes;
  session.lineInOpsCoverage = lineInOpsCoverage;
  session.buildExtraPositionLines = () => buildExtraPositionLines(session);
  attachGenerate(session);
  attachClassGenerate(session);

  return session;
}
