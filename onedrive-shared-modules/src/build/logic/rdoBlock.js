/** Consecutive RDO block. A pin is always off and is not required to sit inside the block. */
export function sortDays(days) {
  return days.slice().sort(function (a, b) { return a - b; });
}

export function normalizeRdoBlock(raw) {
  var v = raw;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    if (raw.rdoBlock == null || raw.rdoBlock === "") return null;
    v = raw.rdoBlock;
  }
  var n = Number(v);
  if (n === 2 || n === 3 || n === 4) return n;
  return null;
}

export function normalizeRdoPins(raw) {
  var list = null;
  if (Array.isArray(raw)) list = raw;
  else if (raw && typeof raw === "object") {
    if (Array.isArray(raw.rdoPins)) list = raw.rdoPins;
    else if (raw.rdoPin != null && raw.rdoPin !== "") list = [raw.rdoPin];
    else list = [];
  }
  if (!list) return [];
  var out = [];
  list.forEach(function (d) {
    var n = Number(d);
    if (Number.isInteger(n) && n >= 0 && n <= 6 && out.indexOf(n) < 0) out.push(n);
  });
  return out.sort(function (a, b) { return a - b; });
}

export function pinRequired(raw) {
  if (!raw || typeof raw !== "object") return false;
  return raw.rdoPinRequired === true || raw.rdoPinRequired === 1 || raw.rdoPinRequired === "true" || raw.rdoPinRequired === "1";
}

/** Circular windows of `length` that contain every pin. Used when the pin cannot sit outside the block. */
export function blocksContaining(pins, length) {
  var blocks = [];
  if (pins.length > length) return blocks;
  for (var start = 0; start < 7; start++) {
    var block = [];
    var missing = false;
    for (var i = 0; i < length; i++) block.push((start + i) % 7);
    for (var p = 0; p < pins.length; p++) {
      if (block.indexOf(pins[p]) < 0) { missing = true; break; }
    }
    if (!missing) blocks.push(block);
  }
  return blocks;
}

/** Circular windows of `length`. */
export function allBlocks(length) {
  var blocks = [];
  for (var start = 0; start < 7; start++) {
    var block = [];
    for (var i = 0; i < length; i++) block.push((start + i) % 7);
    blocks.push(block);
  }
  return blocks;
}

export function unionCount(block, pins) {
  var n = block.length;
  for (var i = 0; i < pins.length; i++) {
    if (block.indexOf(pins[i]) < 0) n++;
  }
  return n;
}

/**
 * Windows for this block.
 * No pin: every consecutive window. Flex fills the rest.
 * Pin with room (4×10 block 2): the pair stays off the pin, so Tue + Fri–Sat is legal.
 * Pin with no room (5×8 block 2): the pair has to include the pin.
 */
export function windowsFor(pins, blockSize, count) {
  if (!pins.length) return allBlocks(blockSize);
  var all = allBlocks(blockSize);
  var disjoint = [];
  var covering = [];
  for (var i = 0; i < all.length; i++) {
    var w = all[i];
    if (unionCount(w, pins) > count) continue;
    var misses = true;
    var covers = true;
    for (var p = 0; p < pins.length; p++) {
      if (w.indexOf(pins[p]) < 0) covers = false;
      else misses = false;
    }
    if (misses) disjoint.push(w);
    else if (covers) covering.push(w);
  }
  if (disjoint.length) return disjoint;
  if (covering.length) return covering;
  return blocksContaining(pins, blockSize);
}

export function withPins(block, pins) {
  var days = block.slice();
  for (var i = 0; i < pins.length; i++) {
    if (days.indexOf(pins[i]) < 0) days.push(pins[i]);
  }
  return days;
}

/** Flex days rotate through the open days. They do not start at Sunday. */
export function pickFromList(free, count, seed) {
  var out = [];
  if (!free.length || count <= 0) return out;
  var n = free.length;
  var step = n > 1 ? Math.max(1, Math.floor(n / Math.max(count, 1))) : 1;
  var idx = Math.abs(seed) % n;
  var guard = 0;
  while (out.length < count && out.length < n && guard < n * 3) {
    var pick = free[idx % n];
    if (out.indexOf(pick) < 0) out.push(pick);
    idx += step;
    guard++;
  }
  return out;
}

export function pickFlex(taken, count, seed) {
  var free = [];
  for (var d = 0; d < 7; d++) if (taken.indexOf(d) < 0) free.push(d);
  return pickFromList(free, count, seed);
}

export function dayKey(days) {
  return sortDays(days).join("-");
}

export function nonPinDays(days, pins) {
  var out = [];
  for (var i = 0; i < days.length; i++) {
    if (pins.indexOf(days[i]) < 0) out.push(days[i]);
  }
  return out;
}

export function sharesNonPin(days, pins, avoid) {
  var extra = nonPinDays(days, pins);
  for (var i = 0; i < extra.length; i++) {
    if (avoid.indexOf(extra[i]) >= 0) return true;
  }
  return false;
}

export function protectPartnerDays(block, pins, windows, avoid) {
  var protect = [];
  var mine = nonPinDays(block, pins);
  var mineKey = dayKey(block);
  for (var i = 0; i < windows.length; i++) {
    var other = windows[i];
    if (dayKey(other) === mineKey) continue;
    if (sharesNonPin(other, pins, avoid) || sharesNonPin(other, pins, mine)) continue;
    var extra = nonPinDays(other, pins);
    for (var j = 0; j < extra.length; j++) {
      var d = extra[j];
      if (protect.indexOf(d) < 0 && block.indexOf(d) < 0 && avoid.indexOf(d) < 0) protect.push(d);
    }
  }
  return protect;
}

export function pickExclusiveFlex(block, avoid, protect, count, seed) {
  var safe = [];
  var fallback = [];
  for (var d = 0; d < 7; d++) {
    if (block.indexOf(d) >= 0 || avoid.indexOf(d) >= 0) continue;
    if (protect.indexOf(d) >= 0) fallback.push(d);
    else safe.push(d);
  }
  var out = pickFromList(safe, count, seed);
  if (out.length < count) {
    var extra = pickFromList(fallback, count - out.length, seed + 5);
    for (var i = 0; i < extra.length; i++) out.push(extra[i]);
  }
  return out;
}

export function readAvoid(opts) {
  if (!opts || !Array.isArray(opts.avoidDays)) return null;
  var avoid = [];
  opts.avoidDays.forEach(function (d) {
    var n = Number(d);
    if (Number.isInteger(n) && n >= 0 && n <= 6 && avoid.indexOf(n) < 0) avoid.push(n);
  });
  return avoid;
}
