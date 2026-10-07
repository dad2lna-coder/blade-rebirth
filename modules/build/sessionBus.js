// @ts-nocheck
/** Fan-out when shared session lines change. Listeners: Build, Review, Ship, Present, Teams. Not a line store. */

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
