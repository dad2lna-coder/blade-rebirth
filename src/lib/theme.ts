export type ThemeName = "dark" | "presentation";

export const THEME_KEY = "blade.theme";

export function isThemeName(value: string | null | undefined): value is ThemeName {
  return value === "dark" || value === "presentation";
}

export function readTheme(): ThemeName {
  if (typeof document === "undefined") return "dark";
  const fromDom = document.documentElement.dataset.theme;
  if (isThemeName(fromDom)) return fromDom;
  return "dark";
}

export function applyTheme(theme: ThemeName) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* storage can be blocked; the theme still applies for this view */
  }
}
