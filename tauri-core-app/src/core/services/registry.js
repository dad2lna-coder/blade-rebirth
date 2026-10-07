const SLOTS = ["stage"];

export function acceptModule(manifest, mod) {
  if (!manifest || !manifest.id) return { ok: false, reason: "missing id" };
  if (!mod || typeof mod[manifest.init] !== "function") return { ok: false, reason: "init is not a function" };
  const slots = manifest.slots || [];
  for (let i = 0; i < slots.length; i++) {
    if (SLOTS.indexOf(slots[i]) < 0) return { ok: false, reason: "unknown slot" };
  }
  return { ok: true };
}
