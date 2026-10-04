import '@testing-library/jest-dom/vitest';

// jsdom has no ResizeObserver, which the map uses to follow the size of its area.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
