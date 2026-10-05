import type { Component } from "svelte";
import manifest from "../../modules/manifest.json";

export type ManifestEntry = {
  id: string;
  label: string;
  mount: string;
  entry: string;
  subs?: ManifestEntry[];
};

export const MANIFEST = manifest as ManifestEntry[];

export type Tab = {
  id: string;
  label: string;
  key: string;
  mount: string;
  mountId: string;
  entry: string;
  subs: Tab[];
};

function toTab(entry: ManifestEntry, index: number, keyed: boolean): Tab {
  return {
    id: entry.id,
    label: entry.label,
    key: keyed ? `F${index + 1}` : "",
    mount: entry.mount,
    mountId: entry.mount.replace(/^#/, ""),
    entry: entry.entry,
    subs: (entry.subs ?? []).map((sub, subIndex) => toTab(sub, subIndex, false)),
  };
}

export const TABS = MANIFEST.map((entry, index) => toTab(entry, index, true));

export type TabId = (typeof TABS)[number]["id"];

export function isTabId(value: string): value is TabId {
  return TABS.some((tab) => tab.id === value);
}

export function tabById(id: string): Tab | undefined {
  return TABS.find((tab) => tab.id === id);
}

const LEGACY: Record<string, { tab: TabId; sub: string | null }> = {
  setup: { tab: "build", sub: null },
  lines: { tab: "review", sub: "lines" },
  coverage: { tab: "review", sub: "coverage" },
  reports: { tab: "review", sub: "reports" },
  "bid-planner": { tab: "ship", sub: null },
  "team-builder": { tab: "teams", sub: null },
};

export function locationState(hash: string): { tab: TabId; sub: string | null } {
  const raw = hash.replace(/^#/, "");
  const [head, child] = raw.split("/");
  const fallback = TABS[0]?.id ?? "plan";

  if (isTabId(head)) {
    const tab = tabById(head);
    const sub = tab?.subs.some((item) => item.id === child)
      ? child
      : (tab?.subs[0]?.id ?? null);
    return { tab: head, sub };
  }

  return LEGACY[head] ?? { tab: fallback, sub: tabById(fallback)?.subs[0]?.id ?? null };
}

export function hashFor(tab: TabId, sub: string | null): string {
  return sub ? `#${tab}/${sub}` : `#${tab}`;
}

const loaders = import.meta.glob("../../modules/**/*.svelte", {
  eager: true,
}) as Record<string, { default: Component }>;

export const panels: Record<string, Component> = {};

function register(entry: ManifestEntry) {
  const loaded = loaders[`../../${entry.entry}`];
  if (loaded) panels[entry.id] = loaded.default;
  entry.subs?.forEach(register);
}

for (const entry of MANIFEST) register(entry);
