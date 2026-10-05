/** Alpha window event names. Reserved here; no feature listeners in this slice. */
export const ALPHA_EVENTS = [
  "lines:request-render",
  "lines:filter-change",
  "lines:sort-change",
  "lines:coverage-refresh",
  "blade-intro-done",
  "setup:mounted",
] as const;

export type AlphaEventName = (typeof ALPHA_EVENTS)[number];

const reserved = new Set<string>(ALPHA_EVENTS);

export function isAlphaEvent(name: string): name is AlphaEventName {
  return reserved.has(name);
}

type EventHandler = (event: CustomEvent) => void;

export function on(name: AlphaEventName, handler: EventHandler): void {
  window.addEventListener(name, handler as EventListener);
}

export function off(name: AlphaEventName, handler: EventHandler): void {
  window.removeEventListener(name, handler as EventListener);
}

export function emit(name: AlphaEventName, detail?: unknown): void {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

export const onEvent = on;
export const emitEvent = emit;
