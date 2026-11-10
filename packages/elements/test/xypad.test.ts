import { describe, expect, test } from "bun:test";
import "../src/xypad/index.ts";
import type { XYPadElement } from "../src/xypad/index.ts";
import { key, mockRect, pointer } from "./helpers.ts";

type Point = { x: number; y: number };

/** 0 to 100 on both axes, step 1, so it starts at the center: 50, 50. A 200×200 pad at the origin. */
function renderXYPad(attributes = "", thumb = 'aria-label="Filter"') {
  document.body.innerHTML = `
    <audio-ui-xypad ${attributes.includes("locale=") ? "" : 'locale="en-US"'} ${attributes}>
      <audio-ui-xypad-control>
        <audio-ui-xypad-thumb ${thumb}></audio-ui-xypad-thumb>
      </audio-ui-xypad-control>
      <audio-ui-xypad-value></audio-ui-xypad-value>
    </audio-ui-xypad>`;
  const root = document.querySelector("audio-ui-xypad") as XYPadElement;
  const pad = root.querySelector("audio-ui-xypad-control") as HTMLElement;
  mockRect(pad, { bottom: 200, height: 200, right: 200, width: 200 });
  const [inputX, inputY] = [...root.querySelectorAll("input")] as [
    HTMLInputElement,
    HTMLInputElement,
  ];
  const changes: [Point, string][] = [];
  const commits: [Point, string][] = [];
  root.addEventListener("input", (event) =>
    changes.push([event.detail.value, event.detail.reason])
  );
  root.addEventListener("change", (event) =>
    commits.push([event.detail.value, event.detail.reason])
  );
  return {
    changes,
    commits,
    inputX,
    inputY,
    pad,
    root,
    thumb: root.querySelector("audio-ui-xypad-thumb") as HTMLElement,
    value: root.querySelector("audio-ui-xypad-value") as HTMLElement,
  };
}

describe("the XY pad's point", () => {
  test("starts at the center, with one named native range input per axis", () => {
    const { inputX, inputY, thumb } = renderXYPad();
    expect(inputX.value).toBe("50");
    expect(inputY.value).toBe("50");
    expect(inputX.getAttribute("aria-label")).toBe("Filter X");
    expect(inputY.getAttribute("aria-label")).toBe("Filter Y");
    expect(inputX.getAttribute("aria-orientation")).toBe("horizontal");
    expect(inputY.getAttribute("aria-orientation")).toBe("vertical");
    expect(inputY.tabIndex).toBe(-1);
    expect(thumb.hasAttribute("aria-label")).toBe(false);
  });

  test("label-x and label-y name the axes after what they control", () => {
    const { inputX, inputY } = renderXYPad(
      "",
      'label-x="Cutoff" label-y="Resonance"'
    );
    expect(inputX.getAttribute("aria-label")).toBe("Cutoff");
    expect(inputY.getAttribute("aria-label")).toBe("Resonance");
  });

  test("clamps a point out of range, each axis on its own", () => {
    const { inputX, inputY } = renderXYPad('value="400 -5"');
    expect(inputX.value).toBe("100");
    expect(inputY.value).toBe("0");
  });

  test("places the thumb and gives the place as CSS variables, y from the top", () => {
    const { root, thumb } = renderXYPad('value="25 80"');
    expect(thumb.style.left).toBe("25%");
    expect(thumb.style.top).toBe("20%");
    expect(root.style.getPropertyValue("--xy-pad-x")).toBe("25%");
    expect(root.style.getPropertyValue("--xy-pad-y")).toBe("20%");
  });

  test("the value part prints both axes, with a semicolon where the decimal mark is a comma", () => {
    expect(renderXYPad('value="25 80"').value.textContent).toBe("25, 80");
    const french = renderXYPad(
      'locale="fr-FR" step-x="0.1" step-y="0.1" value="2.5 0.5"'
    );
    expect(french.value.textContent).toBe("2,5; 0,5");
  });

  test("each axis has its own range and step, on its input", () => {
    const { inputX, inputY } = renderXYPad(
      'min-x="20" max-x="20000" step-x="10" min-y="0" max-y="1" step-y="0.01"'
    );
    expect([inputX.min, inputX.max, inputX.step]).toEqual([
      "20",
      "20000",
      "10",
    ]);
    expect([inputY.min, inputY.max, inputY.step]).toEqual(["0", "1", "0.01"]);
  });

  test("the value property reads and moves the point", () => {
    const { inputX, root } = renderXYPad();
    root.value = { x: 10, y: 90 };
    expect(inputX.value).toBe("10");
    expect(root.value).toEqual({ x: 10, y: 90 });
  });

  test("submits both axes as name.x and name.y, and nothing without a name", () => {
    document.body.innerHTML = `
      <form>
        <audio-ui-xypad name="filter" value="30 70">
          <audio-ui-xypad-control><audio-ui-xypad-thumb aria-label="Filter"></audio-ui-xypad-thumb></audio-ui-xypad-control>
        </audio-ui-xypad>
      </form>`;
    const form = document.querySelector("form") as HTMLFormElement;
    const data = new FormData(form);
    expect([data.get("filter.x"), data.get("filter.y")]).toEqual(["30", "70"]);
    document.querySelector("audio-ui-xypad")?.removeAttribute("name");
    expect([...new FormData(form).keys()]).toEqual([]);
  });

  test("a label part names both inputs when the thumb has no name of its own", () => {
    document.body.innerHTML = `
      <audio-ui-xypad>
        <audio-ui-xypad-label>Filter</audio-ui-xypad-label>
        <audio-ui-xypad-control><audio-ui-xypad-thumb></audio-ui-xypad-thumb></audio-ui-xypad-control>
      </audio-ui-xypad>`;
    const label = document.querySelector("audio-ui-xypad-label") as HTMLElement;
    const inputs = [...document.querySelectorAll("input")];
    expect(
      inputs.map((input) => input.getAttribute("aria-labelledby"))
    ).toEqual([label.id, label.id]);
  });
});

describe("moving the point", () => {
  const cases: [string, KeyboardEventInit, Point][] = [
    ["ArrowUp", {}, { x: 50, y: 51 }],
    ["ArrowDown", {}, { x: 50, y: 49 }],
    ["ArrowRight", {}, { x: 51, y: 50 }],
    ["ArrowLeft", {}, { x: 49, y: 50 }],
    ["ArrowRight", { shiftKey: true }, { x: 60, y: 50 }],
    ["PageUp", {}, { x: 50, y: 60 }],
    ["PageDown", {}, { x: 50, y: 40 }],
    ["Home", {}, { x: 0, y: 50 }],
    ["End", {}, { x: 100, y: 50 }],
  ];
  for (const [name, init, expected] of cases) {
    test(`${init.shiftKey ? "Shift + " : ""}${name} moves it to ${expected.x}, ${expected.y}, and commits`, () => {
      const { changes, commits, inputX } = renderXYPad();
      key(inputX, name, init);
      expect(changes.at(-1)).toEqual([expected, "keyboard"]);
      expect(commits.at(-1)?.[0]).toEqual(expected);
    });
  }

  test("a press jumps to the pointer, a drag follows, the release commits", () => {
    const { changes, commits, pad, thumb } = renderXYPad();
    pointer(pad, "pointerdown", { clientX: 50, clientY: 150, pointerId: 1 });
    expect(changes.at(-1)).toEqual([{ x: 25, y: 25 }, "press"]);
    expect(thumb.hasAttribute("data-dragging")).toBe(true);
    pointer(pad, "pointermove", { clientX: 200, clientY: 0, pointerId: 1 });
    expect(changes.at(-1)).toEqual([{ x: 100, y: 100 }, "drag"]);
    pointer(pad, "pointerup", { clientX: 200, clientY: 0, pointerId: 1 });
    expect(commits.at(-1)).toEqual([{ x: 100, y: 100 }, "drag"]);
    expect(thumb.hasAttribute("data-dragging")).toBe(false);
  });

  test("a press with no drag commits with a press reason", () => {
    const { commits, pad } = renderXYPad();
    pointer(pad, "pointerdown", { clientX: 50, clientY: 150, pointerId: 1 });
    pointer(pad, "pointerup", { clientX: 50, clientY: 150, pointerId: 1 });
    expect(commits.at(-1)).toEqual([{ x: 25, y: 25 }, "press"]);
  });

  test("the wheel moves it by the scrolled distance: up raises y, right raises x", () => {
    const { changes, commits, pad } = renderXYPad();
    pad.dispatchEvent(
      new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        deltaX: 20,
        deltaY: -40,
      })
    );
    expect(changes.at(-1)).toEqual([{ x: 60, y: 70 }, "wheel"]);
    expect(commits.at(-1)?.[0]).toEqual({ x: 60, y: 70 });
  });

  test("a double click and Delete return to default-value, with a reset reason", () => {
    const { changes, inputX, pad } = renderXYPad('default-value="20 80"');
    pointer(pad, "pointerdown", { clientX: 150, clientY: 50, pointerId: 1 });
    pointer(pad, "pointerup", { pointerId: 1 });
    pad.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(changes.at(-1)).toEqual([{ x: 20, y: 80 }, "reset"]);
    pointer(pad, "pointerdown", { clientX: 150, clientY: 50, pointerId: 2 });
    pointer(pad, "pointerup", { pointerId: 2 });
    key(inputX, "Delete");
    expect(changes.at(-1)).toEqual([{ x: 20, y: 80 }, "reset"]);
  });

  test("typing into an axis's input moves that axis, from the input", () => {
    const { changes, inputY } = renderXYPad();
    inputY.value = "70";
    inputY.dispatchEvent(new Event("input", { bubbles: true }));
    expect(changes.at(-1)).toEqual([{ x: 50, y: 70 }, "input-change"]);
  });

  test("a canceled input event refuses the point", () => {
    const { inputX, pad, root } = renderXYPad();
    root.addEventListener("input", (event) => event.preventDefault());
    pointer(pad, "pointerdown", { clientX: 0, clientY: 0, pointerId: 1 });
    expect(inputX.value).toBe("50");
  });

  test("a disabled pad takes no key or press, and every part says so", () => {
    const { changes, inputX, pad, root, thumb } = renderXYPad("disabled");
    key(inputX, "ArrowUp");
    pointer(pad, "pointerdown", { clientX: 50, clientY: 50, pointerId: 1 });
    expect(changes).toEqual([]);
    expect(inputX.disabled).toBe(true);
    for (const part of [root, pad, thumb]) {
      expect(part.hasAttribute("data-disabled")).toBe(true);
    }
  });
});
