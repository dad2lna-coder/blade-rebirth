/** One Vite build per module. Logic-only modules still emit dist/<id>/index.js. */
import { build } from "vite";
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.join(here, "src");
const distRoot = path.join(here, "dist");

const ids = readdirSync(srcRoot, { withFileTypes: true })
  .filter(function (d) { return d.isDirectory(); })
  .map(function (d) { return d.name; });

for (const id of ids) {
  const entry = path.join(srcRoot, id, "index.js");
  const manifest = path.join(srcRoot, id, "manifest.json");
  if (!existsSync(entry) || !existsSync(manifest)) continue;
  const outDir = path.join(distRoot, id);
  mkdirSync(outDir, { recursive: true });
  await build({
    configFile: false,
    root: here,
    logLevel: "warn",
    build: {
      emptyOutDir: true,
      outDir: outDir,
      lib: {
        entry: entry,
        formats: ["es"],
        fileName: "index"
      },
      rollupOptions: {
        output: { entryFileNames: "index.js" }
      }
    }
  });
  copyFileSync(manifest, path.join(outDir, "manifest.json"));
}
