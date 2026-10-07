export function createBus() {
  const listeners = new Map();
  return {
    on(name, fn) {
      const list = listeners.get(name) || [];
      list.push(fn);
      listeners.set(name, list);
      return function off() {
        listeners.set(name, (listeners.get(name) || []).filter(function (f) { return f !== fn; }));
      };
    },
    emit(name, payload) {
      (listeners.get(name) || []).forEach(function (fn) { fn(payload); });
    }
  };
}
