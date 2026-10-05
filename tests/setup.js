import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
  localStorage.clear();
  location.hash = "";
  vi.useRealTimers();
});
Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
  configurable: true,
  value() {
    this.open = true;
  },
});
Object.defineProperty(HTMLDialogElement.prototype, "close", {
  configurable: true,
  value() {
    this.open = false;
  },
});
Object.defineProperty(HTMLMediaElement.prototype, "load", {
  configurable: true,
  value() {},
});
Object.defineProperty(HTMLMediaElement.prototype, "pause", {
  configurable: true,
  value() {
    Object.defineProperty(this, "paused", { configurable: true, value: true });
    this.dispatchEvent(new Event("pause"));
  },
});
Object.defineProperty(HTMLMediaElement.prototype, "play", {
  configurable: true,
  value() {
    Object.defineProperty(this, "paused", { configurable: true, value: false });
    Object.defineProperty(this, "ended", { configurable: true, value: false });
    Object.defineProperty(this, "duration", { configurable: true, value: 12 });
    this.dispatchEvent(new Event("playing"));
    return Promise.resolve();
  },
});
