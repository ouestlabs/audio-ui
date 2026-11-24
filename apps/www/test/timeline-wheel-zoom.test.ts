import { expect, test } from "bun:test";
import { createWheelZoom } from "@/registry/primitives/timeline/wheel-zoom";

/** A viewport 100 px from the left, scrolled by 300 px, counting each layout read. */
function viewport() {
  const element = document.createElement("div");
  let reads = 0;
  element.getBoundingClientRect = () => {
    reads += 1;
    return { left: 100, top: 0, width: 800, height: 200 } as DOMRect;
  };
  Object.defineProperty(element, "scrollLeft", {
    get: () => {
      reads += 1;
      return 300;
    },
  });
  return { element, reads: () => reads };
}

/** A Ctrl + wheel event, with the fields a wheel zoom reads. */
const wheel = (deltaY: number, clientX: number) =>
  ({
    clientX,
    ctrlKey: true,
    deltaMode: 0,
    deltaY,
    metaKey: false,
    preventDefault: () => undefined,
  }) as unknown as WheelEvent;

const nextFrame = () =>
  new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

test("a wheel zoom reads the viewport as the wheel turns, and the frame that zooms reads nothing", async () => {
  const { element, reads } = viewport();
  const zooms: { next: number; offset: number; value: number }[] = [];
  const zoom = createWheelZoom({
    drawnZoom: () => 10,
    duration: 1000,
    origin: () => 0,
    zoomTo: (next, _details, anchor) => {
      zooms.push({ next, ...anchor });
      return true;
    },
  });
  zoom.wheel(wheel(-20, 500), element);
  zoom.wheel(wheel(-20, 500), element);
  const atWheel = reads();
  await nextFrame();
  expect(reads()).toBe(atWheel);
  expect(zooms).toHaveLength(1);
  // The pointer 400 px into the view, scrolled 300 px, at 10 px a unit: 70 units.
  expect(zooms[0]?.offset).toBe(400);
  expect(zooms[0]?.value).toBe(70);
  expect(zooms[0]?.next).toBeGreaterThan(10);
  zoom.dispose();
});
