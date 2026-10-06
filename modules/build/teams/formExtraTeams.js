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

  S.teams.teams.forEach(function (t) {
    var tName = String(t.name || "").trim().toUpperCase();
    var reservedTeam = reserved[tName] || reserved[String(t.extraGroup || "").trim().toUpperCase()];
    if (t.extraGroup && extraByType[t.extraGroup]) {
      t.members = extraByType[t.extraGroup].slice();
      return;
    }
    t.members = (t.members || []).filter(function (m) {
      var line = lines.find(function (l) { return +l.id === +m; });
      if (line && (line.isExtra || line.extraPositionId)) {
        var inOps = S.lineInOpsCoverage ? S.lineInOpsCoverage(line) : !!line.opsFte;
        if (!inOps) return false;
      }
      if (extraIds[+m]) return true;
      if (t.extraGroup && extraByType[t.extraGroup] && extraByType[t.extraGroup].indexOf(m) >= 0) return true;
      return !reservedTeam && !!t.extraGroup;
    });
  });

  if (S.formTrainingTeams) S.formTrainingTeams();
}