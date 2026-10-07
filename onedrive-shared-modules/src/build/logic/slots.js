/** Half-hour slots + coverage-range rebalance. */
export function operatingSlots(openMin, closeMin) {
  var slots = [];
  for (var t = openMin; t < closeMin; t += 30) slots.push(t);
  return slots;
}

export function refineBalance(S, counts, slots, lockedIds) {
  var locked = lockedIds || {};
  var c = Object.assign({}, counts);
  var ids = Object.keys(c);
  if (ids.length < 2) return c;

  function coverageRange(cc) {
    var lo = Infinity, hi = -Infinity;
    slots.forEach(function (slot) {
      var n = 0;
      ids.forEach(function (id) {
        if (S.shiftCoversSlot(id, slot)) n += cc[id] || 0;
      });
      if (n < lo) lo = n;
      if (n > hi) hi = n;
    });
    return hi - lo;
  }

  var best = coverageRange(c);
  for (var iter = 0; iter < 80; iter++) {
    var improved = false;
    for (var i = 0; i < ids.length; i++) {
      if (locked[ids[i]]) continue;
      for (var j = 0; j < ids.length; j++) {
        if (i === j || (c[ids[i]] || 0) <= 0) continue;
        if (locked[ids[j]]) continue;
        c[ids[i]]--;
        c[ids[j]] = (c[ids[j]] || 0) + 1;
        var r = coverageRange(c);
        if (r < best) { best = r; improved = true; }
        else { c[ids[j]]--; c[ids[i]]++; }
      }
    }
    if (!improved) break;
  }
  return c;
}
