import { acceptModule } from "./registry.js";

export async function loadModule(baseUrl, id) {
  const root = String(baseUrl || "").replace(/\/$/, "");
  const manifestUrl = root + "/" + id + "/manifest.json";
  const manifest = await fetch(manifestUrl).then(function (r) { return r.json(); });
  const mod = await import(root + "/" + id + "/index.js");
  const gate = acceptModule(manifest, mod);
  if (!gate.ok) return { id: id, ready: false, reason: gate.reason };
  return { id: id, ready: true, manifest: manifest, mod: mod };
}
