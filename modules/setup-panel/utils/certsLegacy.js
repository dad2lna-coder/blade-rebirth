// @ts-nocheck
export function readCertConfigFromDom(S) {
  var dfoEl = typeof document !== "undefined" ? document.getElementById("cfg-cert-dfo") : null;
  var paxEl = typeof document !== "undefined" ? document.getElementById("cfg-cert-pax") : null;
  var bagEl = typeof document !== "undefined" ? document.getElementById("cfg-cert-bag") : null;
  var dfoOn = typeof document !== "undefined" ? document.getElementById("cfg-cert-dfo-on") : null;
  var bagOn = typeof document !== "undefined" ? document.getElementById("cfg-cert-bag-on") : null;
  S.state.certDfoMax = Math.max(0, Math.floor(+(dfoEl && dfoEl.value) || 0));
  S.state.certPaxMax = Math.max(0, Math.floor(+(paxEl && paxEl.value) || 0));
  S.state.certBagMax = Math.max(0, Math.floor(+(bagEl && bagEl.value) || 0));
  S.state.certDfoEnabled = !dfoOn || !!dfoOn.checked;
  S.state.certBagEnabled = !bagOn || !!bagOn.checked;
}

export function clearLineFunctions(S) {
  (S.state.lines || []).forEach(function (l) { l.function = ""; });
}

export function assignCertifications(S) {
  readCertConfigFromDom(S);
  if (!S.state.lines || !S.state.lines.length) {
    if (S.updateStatus) S.updateStatus("Generate lines first, then assign certifications.");
    return;
  }
  clearLineFunctions(S);
  var need = [];
  if (S.state.certDfoEnabled && S.state.certDfoMax > 0) {
    for (var i = 0; i < S.state.certDfoMax; i++) need.push("DFO");
  }
  if (S.state.certPaxMax > 0) {
    for (var j = 0; j < S.state.certPaxMax; j++) need.push("PAX");
  }
  if (S.state.certBagEnabled && S.state.certBagMax > 0) {
    for (var k = 0; k < S.state.certBagMax; k++) need.push("BAG");
  }
  if (!need.length) {
    if (S.renderLines) S.renderLines();
    if (S.updateStatus) S.updateStatus("No certification targets (max 0 or disabled). Functions cleared.");
    return;
  }
  var eligible = S.state.lines.filter(function (l) {
    return !l.isStso && !l.isLtso && l.empClass !== "STSO" && l.empClass !== "LTSO";
  });
  eligible.sort(function (a, b) {
    var sa = S.getShift ? S.getShift(a.shiftId) : null;
    var sb = S.getShift ? S.getShift(b.shiftId) : null;
    var ma = sa ? S.timeToMin(sa.start) : 0;
    var mb = sb ? S.timeToMin(sb.start) : 0;
    if (ma !== mb) return ma - mb;
    if (a.sex !== b.sex) return a.sex === "F" ? -1 : 1;
    return (a.id || 0) - (b.id || 0);
  });
  var assigned = { DFO: 0, PAX: 0, BAG: 0 };
  var used = {};
  var ei = 0;
  need.forEach(function (fn) {
    var tries = 0;
    while (tries < eligible.length) {
      var line = eligible[ei % eligible.length];
      ei++; tries++;
      if (!line || used[line.id]) continue;
      if (line.function) continue;
      line.function = fn;
      used[line.id] = true;
      assigned[fn]++;
      return;
    }
  });
  if (S.renderLines) S.renderLines();
  if (S.renderTeams) S.renderTeams();
  var hint = typeof document !== "undefined" ? document.getElementById("cert-assign-hint") : null;
  var msg = "Assigned DFO " + assigned.DFO + " \u00b7 PAX " + assigned.PAX + " \u00b7 BAG " + assigned.BAG + " (schedules unchanged)";
  if (hint) hint.textContent = msg;
  if (S.updateStatus) S.updateStatus(msg);
}
