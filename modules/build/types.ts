export type SexCount = { M: number; F: number };

export type ClassOption = { key: string; label: string };

export type ShiftDef = {
  id: string;
  name?: string;
  start?: string;
  end?: string;
  crewGroupId?: string;
};

export type ExtraPosition = {
  id: string;
  name?: string;
  m?: number;
  f?: number;
  ignoreGender?: boolean;
  dropM?: number;
  dropF?: number;
};

export type PositionGender = {
  ignoreGender?: boolean;
  dropM?: number;
  dropF?: number;
};

export type ScheduleLine = {
  id: string | number;
  shiftId?: string;
  sex?: string;
  isShortfall?: boolean;
  function?: string;
  lineCode?: string;
  shiftName?: string;
  rdoDays?: number[];
  empClass?: string;
  countSex?: boolean;
};

export type CrewGroup = {
  id: string;
  name?: string;
  shiftIds?: string[];
};

export type SetupState = {
  startDate?: string | null;
  extraPositions: ExtraPosition[];
  shifts: ShiftDef[];
  lines: ScheduleLine[];
  schedule: Record<string, string[] | undefined>;
  functionRotation: Record<string, string[] | undefined>;
  shiftCrewGroups: CrewGroup[];
  positionGender?: Record<string, PositionGender>;
  esti?: number;
  msti?: number;
};

export type Headcount = { M: number; F: number; total: number };

export type ParityProposal = {
  lineA: ScheduleLine;
  lineB: ScheduleLine;
  rdoA_before: number[];
  rdoB_before: number[];
  rdoA_after: number[];
  rdoB_after: number[];
  note: string;
};

export type ParityResult = {
  summary?: string;
  proposals?: ParityProposal[];
};

export type DfoProposal = {
  donorLine: ScheduleLine;
  receiverLine: ScheduleLine;
  donorShift?: { id: string; name?: string };
  receiverShift?: { id: string; name?: string };
  sex?: string;
  note?: string;
};

export type DfoResult = {
  summary?: string;
  mode?: string;
  proposals?: DfoProposal[];
  certCountPerShift?: number;
};

export type ParitySwap = {
  lineAId: string;
  lineBId: string;
  rdoA_after: number[];
  rdoB_after: number[];
};

export type SetupSession = {
  state: SetupState;
  belongsToClass: (line: ScheduleLine, classKey: string) => boolean;
  getClassHeadcount: (classKey: string) => Headcount;
  generateClass: (classKey: string, targets: Record<string, SexCount> | null) => void;
  generate: () => void;
  checkParity: (classKey: string, bands: string[]) => ParityResult;
  approveParitySwaps: (pairs: ParitySwap[]) => void;
  proposeDfoCertBalance: (classKey: string) => DfoResult;
  approveDfoCertBalance: (result: DfoResult, selected: DfoProposal[]) => void;
};

export type ModalUi = {
  activeTargetClass: string;
  activeParityClass: string;
  activeDfoClass: string;
  perShiftTargets: Record<string, Record<string, SexCount>>;
  selectedParityBands: Record<string, boolean>;
  parityResult: ParityResult | null;
  parityChecked: boolean[];
  dfoResult: DfoResult | null;
  dfoChecked: boolean[];
  revision: number;
};
