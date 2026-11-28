import { afterEach, describe, expect, mock, test } from "bun:test";
import {
  type SortableDragOptions,
  startSortableDrag,
} from "@/registry/lib/sortable-drag";

const frame = () => new Promise((resolve) => setTimeout(resolve, 30));

/** Three items 100 px wide, side by side. */
function row() {
  return [0, 1, 2].map((index) => {
    const item = document.createElement("div");
    item.getBoundingClientRect = () => new DOMRect(index * 100, 0, 100, 40);
    document.body.appendChild(item);
    return item;
  });
}

const pointer = (type: string, clientX: number) =>
  new PointerEvent(type, {
    bubbles: true,
    button: 0,
    buttons: type === "pointerup" ? 0 : 1,
    clientX,
    clientY: 20,
    isPrimary: true,
    pointerId: 1,
    pointerType: "mouse",
  });

function press(options: Partial<SortableDragOptions> = {}) {
  const items = row();
  const onEnd = mock((_index: number | null, _released: boolean) => undefined);
  const onLift = mock(() => undefined);
  const down = pointer("pointerdown", 50);
  items[0]?.dispatchEvent(down);
  startSortableDrag({
    axis: "x",
    event: down,
    from: 0,
    ghost: () => null,
    items,
    onEnd,
    onLift,
    scroller: null,
    ...options,
  });
  const move = async (clientX: number) => {
    document.dispatchEvent(pointer("pointermove", clientX));
    await frame();
  };
  const release = async (clientX: number) => {
    document.dispatchEvent(pointer("pointerup", clientX));
    await frame();
  };
  return { items, move, onEnd, onLift, release };
}

// happy-dom lays nothing out: nothing is under the pointer for the scroll to find.
document.elementsFromPoint = () => [];

afterEach(() => {
  document.body.innerHTML = "";
});

describe("startSortableDrag", () => {
  test("a press that barely moves stays a press", async () => {
    const drag = press();
    await drag.move(52);
    await drag.release(52);
    expect(drag.onLift).not.toHaveBeenCalled();
    expect(drag.onEnd).not.toHaveBeenCalled();
  });

  test("dragged past its neighbors, an item lands after them, which slid aside", async () => {
    const drag = press();
    await drag.move(260);
    expect(drag.onLift).toHaveBeenCalledTimes(1);
    expect(drag.items.map((item) => item.style.transform)).toEqual([
      "translateX(200px)",
      "translateX(-100px)",
      "translateX(-100px)",
    ]);
    expect(drag.items[0]?.style.opacity).toBe("0.3");
    await drag.release(260);
    expect(drag.onEnd.mock.calls).toEqual([[2, true]]);
    expect(drag.items.map((item) => item.style.cssText)).toEqual(["", "", ""]);
    expect(document.documentElement.style.cursor).toBe("");
  });

  test("Escape puts it back", async () => {
    const drag = press();
    await drag.move(260);
    document.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "Escape" })
    );
    await frame();
    expect(drag.onEnd.mock.calls).toEqual([[null, false]]);
    expect(drag.items.map((item) => item.style.transform)).toEqual([
      "",
      "",
      "",
    ]);
  });

  test("dropped elsewhere, it stays where it was and reports a release", async () => {
    const elsewhere = mock((x: number) => x > 250);
    const drag = press({ elsewhere });
    await drag.move(260);
    await drag.release(260);
    expect(drag.onEnd.mock.calls).toEqual([[null, true]]);
  });
});
