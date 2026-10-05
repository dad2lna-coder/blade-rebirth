// @ts-nocheck
/** Notifies Ship when the shared setup session lines change. Not a line store. */

const listeners = new Set();

export function onSessionLines(listener) {
  listeners.add(listener);
  return function stop() {
    listeners.delete(listener);
  };
}

export function notifySessionLines() {
  listeners.forEach(function (listener) {
    listener();
  });
}
