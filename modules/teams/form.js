// @ts-nocheck
/** Auto-form teams from the shared session. No drag-and-drop. */

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function timeToMin(session, text) {
  if (session && typeof session.timeToMin === "function") return session.timeToMin(text);
  const match = String(text || "").match(/^(\d{1,2}):(\d{2})/);
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}

function shiftOf(session, line) {
  if (!line) return null;
  if (session && typeof session.getShift === "function") return session.getShift(line.shiftId) || null;
  const shifts = (session && session.state && session.state.shifts) || [];
  return shifts.find(function (shift) { return shift.id === line.shiftId; }) || null;
}

function roleOf(line) {
  if (!line) return "TSO";
  if (line.isStso || line.empClass === "STSO" || line.position === "STSO") return "STSO";
  if (line.isLtso || line.empClass === "LTSO" || line.position === "LTSO") return "LTSO";
  return "TSO";
}

function rdoDays(line) {
  return (line && line.rdoDays || []).map(Number).filter(function (day) {
    return day >= 0 && day <= 6;
  });
}

function rdoKey(line) {
  return rdoDays(line).slice().sort(function (a, b) { return a - b; }).join(",");
}

function rdoLabel(line) {
  const key = rdoKey(line);
  if (!key) return "—";
  return key.split(",").map(function (day) { return DAYS[+day] || day; }).join(",");
}

function inOps(session, line) {
  if (!line) return false;
  if (session && typeof session.lineInOpsCoverage === "function") return !!session.lineInOpsCoverage(line);
  if (line.isExtra || line.extraPositionId) return !!line.opsFte;
  return true;
}

export function collectPool(session) {
  const lines = (session && session.state && session.state.lines) || [];
  return lines.filter(function (line) { return inOps(session, line); }).map(function (line) {
    const shift = shiftOf(session, line);
    const start = line.startTime || (shift && shift.start) || "";
    return {
      id: line.id,
      lineCode: line.lineCode || ("L" + line.id),
      role: roleOf(line),
      start: start,
      startMin: timeToMin(session, start),
      rdo: rdoKey(line),
      rdoLabel: rdoLabel(line),
      sex: line.sex === "F" ? "F" : "M",
      shiftName: (shift && shift.name) || line.shiftName || line.shiftId || "",
    };
  });
}

function parseRdoDays(person) {
  if (person && Array.isArray(person.rdoDays)) return person.rdoDays.map(Number).filter(function (day) { return day >= 0 && day <= 6; });
  const raw = person && person.rdo != null ? String(person.rdo) : "";
  if (!raw) return [];
  return raw.split(/[/,]+/).map(function (part) { return parseInt(part, 10); }).filter(function (day) { return day >= 0 && day <= 6; });
}

function rdoOverlap(a, b) {
  const days = new Set(parseRdoDays(a));
  let count = 0;
  parseRdoDays(b).forEach(function (day) { if (days.has(day)) count += 1; });
  return count;
}

function rdoExact(a, b) {
  const left = parseRdoDays(a).slice().sort().join(",");
  const right = parseRdoDays(b).slice().sort().join(",");
  return left === right && left !== "";
}

function startMins(person) {
  if (person && person.startMin != null && person.startMin !== "") return +person.startMin;
  return null;
}

function startsClose(a, b, windowMin) {
  const left = startMins(a);
  const right = startMins(b);
  if (left == null || right == null) return String(a.start || "") === String(b.start || "");
  const diff = Math.abs(left - right);
  return Math.min(diff, 24 * 60 - diff) <= windowMin;
}

function counts(team, byId) {
  const tally = { STSO: { M: 0, F: 0 }, LTSO: { M: 0, F: 0 }, TSO: { M: 0, F: 0 } };
  (team.members || []).forEach(function (id) {
    const person = byId.get(+id) || byId.get(id);
    if (!person) return;
    const role = person.role === "STSO" || person.role === "LTSO" ? person.role : "TSO";
    tally[role][person.sex === "F" ? "F" : "M"] += 1;
  });
  return tally;
}

function sexScore(team, candidate, byId) {
  const tally = counts(team, byId);
  let male = tally.STSO.M + tally.LTSO.M + tally.TSO.M;
  let female = tally.STSO.F + tally.LTSO.F + tally.TSO.F;
  if (candidate.sex === "F") female += 1;
  else male += 1;
  return Math.abs(male - female) / Math.max(1, male + female);
}

function roleScore(team, role, candidate, byId) {
  const tally = counts(team, byId);
  let male = tally[role].M;
  let female = tally[role].F;
  if (candidate.sex === "F") female += 1;
  else male += 1;
  return Math.abs(male - female) / Math.max(1, male + female);
}

function phaseOf(startMin) {
  return (startMin || 0) < 14 * 60 ? "AM" : "PM";
}

function renumber(teams, byId) {
  teams.sort(function (a, b) {
    const as = startMins(byId.get(a.members[0])) || 0;
    const bs = startMins(byId.get(b.members[0])) || 0;
    return as - bs || String(a.id).localeCompare(String(b.id));
  });
  const width = Math.max(2, String(teams.length).length);
  teams.forEach(function (team, index) {
    const anchor = byId.get(team.members[0]);
    team.phase = phaseOf(anchor && anchor.startMin);
    team.name = String(index + 1).padStart(width, "0");
  });
}

export function autoFormTeams(session, opts) {
  const pool = collectPool(session);
  const byId = new Map(pool.map(function (person) { return [person.id, person]; }));
  const options = opts || {};
  const stsoPer = Math.max(0, Number(options.stsoPer) || 1);
  const ltsoPer = Math.max(0, Number(options.ltsoPer) || 0);
  const tsoPer = Math.max(0, Number(options.tsoPer) || 0);
  const windowMin = Math.max(0, Math.min(180, Number(options.startWindowMin) || 0));
  const allowOne = !!options.allowOneRdo;
  const byRole = { STSO: [], LTSO: [], TSO: [] };
  pool.forEach(function (person) { (byRole[person.role] || byRole.TSO).push(person); });
  if (!byRole.STSO.length) return [];

  const teams = byRole.STSO
    .slice()
    .sort(function (a, b) {
      return (startMins(a) || 0) - (startMins(b) || 0) || String(a.rdo || "").localeCompare(String(b.rdo || ""));
    })
    .map(function (person, index) {
      return { id: "T" + (index + 1), name: "", members: [person.id], phase: null };
    });
  const used = new Set(teams.map(function (team) { return team.members[0]; }));
  renumber(teams, byId);

  teams.forEach(function (team) {
    const anchor = byId.get(team.members[0]);
    if (!anchor) return;
    ["STSO", "LTSO", "TSO"].forEach(function (role) {
      const tally = counts(team, byId);
      const have = tally[role].M + tally[role].F;
      const target = role === "STSO" ? stsoPer : role === "LTSO" ? ltsoPer : tsoPer;
      const need = Math.max(0, target - have);
      if (!need) return;
      const scored = byRole[role].filter(function (person) { return !used.has(person.id); }).map(function (person) {
        let quality = 0;
        if (startsClose(person, anchor, windowMin)) {
          if (rdoExact(person, anchor)) quality = 3;
          else if (allowOne && rdoOverlap(person, anchor) >= 1) quality = 1;
        }
        return {
          person: person,
          quality: quality,
          opp: role === "LTSO" && person.sex !== anchor.sex ? 1 : 0,
          teamSex: sexScore(team, person, byId),
          roleSex: roleScore(team, role, person, byId),
        };
      }).filter(function (item) { return item.quality > 0; });
      scored.sort(function (a, b) {
        return b.quality - a.quality || b.opp - a.opp || a.teamSex - b.teamSex || a.roleSex - b.roleSex;
      });
      scored.slice(0, need).forEach(function (item) {
        team.members.push(item.person.id);
        used.add(item.person.id);
      });
    });
  });
  renumber(teams, byId);
  return teams;
}

export function writeTeams(session, teams) {
  if (!session.teams) session.teams = { teams: [] };
  session.teams.teams = teams;
  return session.teams.teams;
}
