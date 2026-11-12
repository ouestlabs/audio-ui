import { afterEach } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

// happy-dom does not implement the pointer-capture API that usePointerDrag
// relies on; without hasPointerCapture returning true, drags abort mid-move.
if (!Element.prototype.setPointerCapture) {
  const captured = new WeakMap<Element, Set<number>>();
  Element.prototype.setPointerCapture = function (pointerId: number) {
    let ids = captured.get(this);
    if (!ids) {
      ids = new Set();
      captured.set(this, ids);
    }
    ids.add(pointerId);
  };
  Element.prototype.hasPointerCapture = function (pointerId: number) {
    return captured.get(this)?.has(pointerId) ?? false;
  };
  Element.prototype.releasePointerCapture = function (pointerId: number) {
    captured.get(this)?.delete(pointerId);
  };
}

const { cleanup } = await import("@testing-library/react");

afterEach(() => {
  cleanup();
});
