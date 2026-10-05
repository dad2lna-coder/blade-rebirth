export const TABS = [
  { id: "setup", label: "Setup", key: "F1" },
  { id: "lines", label: "Lines", key: "F2" },
  { id: "coverage", label: "Coverage", key: "F3" },
  { id: "reports", label: "Reports", key: "F4" },
  { id: "bid-planner", label: "Bid Planner", key: "F5" },
  { id: "team-builder", label: "Team Builder", key: "F6" },
] as const;

export type TabId = (typeof TABS)[number]["id"];

export function isTabId(value: string): value is TabId {
  return TABS.some((tab) => tab.id === value);
}
