import { expect, test } from "bun:test";
import { measuredBox } from "@/registry/primitives/primitive";

/** An element whose box moves when told, counting each time it is measured. */
function counted() {
  const element = document.createElement("div");
  document.body.appendChild(element);
  let left = 10;
  let reads = 0;
  element.getBoundingClientRect = () => {
    reads += 1;
    return { left, top: 0, width: 100, height: 20 } as DOMRect;
  };
  return {
    element,
    move: (to: number) => {
      left = to;
    },
    reads: () => reads,
  };
}

test("a gesture's box is measured once, however often it is read", () => {
  const { element, reads } = counted();
  const box = measuredBox(element);
  for (const _ of Array.from({ length: 5 })) {
    expect(box.get().left).toBe(10);
  }
  expect(reads()).toBe(1);
  box.stop();
});

test("a scroll or a resize during the gesture measures it again", () => {
  const { element, move, reads } = counted();
  const box = measuredBox(element);
  box.get();
  move(-40);
  window.dispatchEvent(new Event("scroll"));
  expect(box.get().left).toBe(-40);
  move(5);
  window.dispatchEvent(new Event("resize"));
  expect(box.get().left).toBe(5);
  expect(reads()).toBe(3);
  box.stop();
});

test("a scroll inside a scrolling parent counts too", () => {
  const { element, move } = counted();
  const box = measuredBox(element);
  box.get();
  move(70);
  element.dispatchEvent(new Event("scroll"));
  expect(box.get().left).toBe(70);
  box.stop();
});

test("once stopped, a scroll no longer measures it again", () => {
  const { element, move, reads } = counted();
  const box = measuredBox(element);
  box.get();
  box.stop();
  move(99);
  window.dispatchEvent(new Event("scroll"));
  box.get();
  expect(reads()).toBe(1);
});
