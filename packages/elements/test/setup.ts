import { afterEach } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();

// happy-dom does not implement the pointer-capture API a control sets on a
// press; without it, a press throws before the drag starts.
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

afterEach(() => {
  document.body.replaceChildren();
});
