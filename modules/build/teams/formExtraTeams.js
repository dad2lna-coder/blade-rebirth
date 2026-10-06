// @ts-nocheck
/** Form extra teams from lines that have extraPositionId or isExtra.
 *  Mutates S.teams in place. No DOM access, no UI refresh.
 */
export function formExtraTeams(S) {
  var lines = S.state.lines || [];
  var reserved = { TSO: true, LTSO: true, STSO: true, FT: true, PT: true };

  function extraTypeKey(l) {
    var name = String(l.extraName || l.position || "").trim();
    if (name && !reserved[name]) return name;
    return "";
  }

  S.teams = S.teams || { teams: [] };
  if (!Array.isArray(S.teams.teams)) S.teams.teams = [];

  var extraByType = {};
  var extraIds = {};
  lines.forEach(function (l) {
    if (!(l.isExtra || l.extraPositionId)) return;
    if (l.isTraining || (S.isTrainingLine && S.isTrainingLine(l))) return;
    var inOps = S.lineInOpsCoverage ? S.lineInOpsCoverage(l) : !!l.opsFte;
    if (!inOps) return;
    extraIds[+l.id] = true;
    var key = extraTypeKey(l);
    if (!key) return;
    if (!extraByType[key]) extraByType[key] = [];
    extraByType[key].push(l.id);
  });

  Object.keys(extraByType).forEach(function (typeName) {
    var team = S.teams.teams.find(function (t) { return t.extraGroup === typeName || t.name === typeName; });
    if (!team) {
      team = { id: "TX-" + typeName, name: typeName, members: [], followMe: false, phase: null, extraGroup: typeName };
      S.teams.teams.push(team);
    }
    team.extraGroup = typeName;
    team.name = typeName;
    var have = {};
    (team.members || []).forEach(function (m) { have[+m] = true; });
    extraByType[typeName].forEach(function (id) {
      if (!have[+id]) team.members.push(id);
    });
  });

  // FIX: Keep non-extra members unless their id is an extra being rebuilt.
  // Match trainingClasses pattern: keep unless id is an extra being rebuilt.
  S.teams.teams.forEach(function (t) {
    var tName = String(t.name || "").trim().toUpperCase();
    var reservedTeam = reserved[tName] || reserved[String(t.extraGroup || "").trim().toUpperCase()];
    if (t.extraGroup && extraByType[t.extraGroup]) {
      t.members = extraByType[t.extraGroup].slice();
      return;
    }
    t.members = (t.members || []).filter(function (m) {
      // Keep member unless they are an extra being rebuilt (in extraIds)
      // This preserves non-extra members on user teams
      if (extraIds[+m]) return false;
      return true;
    });
  });

  if (S.formTrainingTeams) S.formTrainingTeams();
}