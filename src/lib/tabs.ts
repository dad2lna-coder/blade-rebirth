import type { Component } from "svelte";
import manifest from "../../modules/manifest.json";

export type ManifestEntry = {
  id: string;
  label: string;
  mount: string;
  entry: string;
};

export const MANIFEST = manifest as ManifestEntry[];

export const TABS = MANIFEST.map((entry, index) => ({
  id: entry.id,
  label: entry.label,
  key: `F${index + 1}`,
  mount: entry.mount,
  mountId: entry.mount.replace(/^#/, ""),
  entry: entry.entry,
}));

export type TabId = (typeof TABS)[number]["id"];

export function isTabId(value: string): value is TabId {
  return TABS.some((tab) => tab.id === value);
}

const loaders = import.meta.glob("../../modules/**/*.svelte", {
  eager: true,
}) as Record<string, { default: Component }>;

export const panels: Record<string, Component> = {};

for (const entry of MANIFEST) {
  const loaded = loaders[`../../${entry.entry}`];
  if (loaded) panels[entry.id] = loaded.default;
}
