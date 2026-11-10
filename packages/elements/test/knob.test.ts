import { describe, expect, test } from "bun:test";
import "../src/knob/index.ts";
import type { KnobElement, KnobInputEvent } from "../src/knob/index.ts";
import { key, listen, mockRect, pointer } from "./helpers.ts";

/** A knob from `markup` attributes: min 0, max 100, step 1, so it starts at 50. */
function renderKnob(attributes = "", thumb = 'aria-label="Cutoff"') {
  document.body.innerHTML = `
    <audio-ui-knob ${attributes}>
      <audio-ui-knob-control>
        <audio-ui-knob-track></audio-ui-knob-track>
        <audio-ui-knob-indicator></audio-ui-knob-indicator>
        <audio-ui-knob-thumb ${thumb}></audio-ui-knob-thumb>
      </audio-ui-knob-control>
      <audio-ui-knob-value></audio-ui-knob-value>
    </audio-ui-knob>`;
  const knob = document.querySelector("audio-ui-knob") as KnobElement;
  const control = knob.querySelector("audio-ui-knob-control") as HTMLElement;
  const thumbElement = knob.querySelector("audio-ui-knob-thumb") as HTMLElement;
  // A 100×100 knob at the origin: its center is (50, 50).
  mockRect(control, { bottom: 100, height: 100, right: 100, width: 100 });
  return {
    control,
    events: listen(knob),
    indicator: knob.querySelector("audio-ui-knob-indicator") as HTMLElement,
    input: thumbElement.querySelector("input") as HTMLInputElement,
    knob,
    thumb: thumbElement,
    track: knob.querySelector("audio-ui-knob-track") as HTMLElement,
    value: knob.querySelector("audio-ui-knob-value") as HTMLElement,
  };
}

function tap(control: Element, pointerId: number) {
  pointer(control, "pointerdown", { clientX: 50, clientY: 10, pointerId });
  pointer(control, "pointerup", { clientX: 50, clientY: 10, pointerId });
}

describe("the knob's value", () => {
  test("defaults to the midpoint, with an accessible native range input named by the thumb's aria-label", () => {
    const { input, thumb } = renderKnob();
    expect(input.type).toBe("range");
    expect(input.value).toBe("50");
    expect(input.min).toBe("0");
    expect(input.max).toBe("100");
    expect(input.getAttribute("aria-label")).toBe("Cutoff");
    // Named once: the thumb hands its name to the input.
    expect(thumb.hasAttribute("aria-label")).toBe(false);
  });

  test("starts at default-value, holds a value set by attribute or property, and clamps it", () => {
    expect(renderKnob('default-value="12"').input.value).toBe("12");
    expect(renderKnob('value="400"').input.value).toBe("100");
    const { input, knob } = renderKnob();
    knob.value = 30;
    expect(input.value).toBe("30");
    expect(knob.value).toBe(30);
  });

  test("formats the value for the value part and aria-valuetext, from a format attribute", () => {
    const { input, value } = renderKnob(
      `min="0" max="1" step="0.01" value="0.25" locale="en-US" format='{"style":"percent"}'`
    );
    expect(value.textContent).toBe("25%");
    expect(input.getAttribute("aria-valuetext")).toBe("25%");
  });

  test("a label part names the input when the thumb has no name of its own", () => {
    document.body.innerHTML = `
      <audio-ui-knob>
        <audio-ui-knob-label>Resonance</audio-ui-knob-label>
        <audio-ui-knob-control><audio-ui-knob-thumb></audio-ui-knob-thumb></audio-ui-knob-control>
      </audio-ui-knob>`;
    const label = document.querySelector("audio-ui-knob-label") as HTMLElement;
    const input = document.querySelector("input") as HTMLInputElement;
    expect(label.id).not.toBe("");
    expect(input.getAttribute("aria-labelledby")).toBe(label.id);
  });

  test("the thumb rotates with the value over a 288° sweep from 216°", () => {
    expect(renderKnob('value="0"').thumb.style.rotate).toBe("216deg");
    expect(renderKnob('value="100"').thumb.style.rotate).toBe("504deg");
  });

  test("the track draws the whole arc; the indicator nothing at its anchor, then from it", () => {
    const { track, indicator } = renderKnob('value="0"');
    expect(track.querySelector("svg path")).not.toBeNull();
    expect(indicator.querySelector("path")).toBeNull();
    const pan = renderKnob(
      'anchor="0" min="-1" max="1" step="0.1" value="0.5"'
    );
    expect(pan.indicator.querySelector("path")).not.toBeNull();
  });

  test("a log scale puts the geometric middle at the middle of the dial", () => {
    const { thumb } = renderKnob(
      'scale="log" min="20" max="20000" value="632"'
    );
    const angle = Number.parseFloat(thumb.style.rotate);
    expect(angle).toBeCloseTo(360, 0);
  });

  test("its name and value go to a form", () => {
    document.body.innerHTML = `
      <form>
        <audio-ui-knob name="cutoff" value="42">
          <audio-ui-knob-control><audio-ui-knob-thumb aria-label="Cutoff"></audio-ui-knob-thumb></audio-ui-knob-control>
        </audio-ui-knob>
      </form>`;
    const form = document.querySelector("form") as HTMLFormElement;
    expect(new FormData(form).get("cutoff")).toBe("42");
  });
});

describe("turning the knob", () => {
  test("ArrowUp reports an input and a change with a keyboard reason", () => {
    const { events, input } = renderKnob();
    const event = key(input, "ArrowUp");
    expect(event.defaultPrevented).toBe(true);
    expect(input.value).toBe("51");
    expect(events.changes).toEqual([[51, "keyboard"]]);
    expect(events.commits).toEqual([[51, "keyboard"]]);
  });

  test("Page, Home, End and Shift + arrow move by the large step or to the ends", () => {
    const { input } = renderKnob();
    key(input, "PageUp");
    expect(input.value).toBe("60");
    key(input, "ArrowDown", { shiftKey: true });
    expect(input.value).toBe("50");
    key(input, "End");
    expect(input.value).toBe("100");
    key(input, "Home");
    expect(input.value).toBe("0");
  });

  test("a value set from outside is where the next key starts", () => {
    const { events, input, knob } = renderKnob();
    knob.value = 30;
    key(input, "ArrowUp");
    expect(knob.value).toBe(31);
    expect(events.changes).toEqual([[31, "keyboard"]]);
    // It stays there when the knob takes its attributes again.
    knob.setAttribute("large-step", "5");
    expect(knob.value).toBe(31);
  });

  test("the wheel steps with a wheel reason", () => {
    const { control, events } = renderKnob();
    control.dispatchEvent(
      new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: -100 })
    );
    expect(events.changes).toEqual([[51, "wheel"]]);
  });

  test("a canceled input event refuses the value", () => {
    const { events, input, knob } = renderKnob();
    knob.addEventListener("input", (event) => event.preventDefault());
    key(input, "ArrowUp");
    expect(input.value).toBe("50");
    expect(events.commits).toEqual([]);
  });

  test("circular: a quarter turn clockwise adds a quarter turn of the 288° sweep", () => {
    const { control, events } = renderKnob();
    pointer(control, "pointerdown", { clientX: 50, clientY: 0, pointerId: 1 });
    pointer(control, "pointermove", {
      clientX: 100,
      clientY: 50,
      pointerId: 1,
    });
    // 90° / 288° × 100 = 31.25, from 50: 81 once on the step.
    expect(events.changes.at(-1)).toEqual([81, "drag"]);
    expect(events.commits).toEqual([]);
    pointer(control, "pointerup", { clientX: 100, clientY: 50, pointerId: 1 });
    expect(events.commits).toEqual([[81, "drag"]]);
  });

  test("vertical: 150 px of upward travel spans the whole range", () => {
    const { control, events } = renderKnob('drag-mode="vertical"');
    pointer(control, "pointerdown", { clientX: 50, clientY: 90, pointerId: 1 });
    pointer(control, "pointermove", { clientX: 50, clientY: 75, pointerId: 1 });
    expect(events.changes.at(-1)?.[0]).toBe(60);
  });

  test("every part carries data-dragging while a pointer drags, and data-drag-mode", () => {
    const { control, knob, thumb, track } = renderKnob();
    expect(control.getAttribute("data-drag-mode")).toBe("circular");
    pointer(control, "pointerdown", { clientX: 50, clientY: 0, pointerId: 1 });
    for (const part of [knob, control, thumb, track]) {
      expect(part.hasAttribute("data-dragging")).toBe(true);
    }
    pointer(control, "pointerup", { clientX: 50, clientY: 0, pointerId: 1 });
    expect(thumb.hasAttribute("data-dragging")).toBe(false);
  });

  test("two quick taps return to default-value, with a reset reason; so do Delete and Alt + click", () => {
    const { control, events, input } = renderKnob('default-value="30"');
    key(input, "End");
    tap(control, 1);
    tap(control, 2);
    expect(input.value).toBe("30");
    expect(events.commits.at(-1)).toEqual([30, "reset"]);
    key(input, "End");
    key(input, "Delete");
    expect(input.value).toBe("30");
    key(input, "End");
    pointer(control, "pointerdown", {
      altKey: true,
      clientX: 50,
      clientY: 10,
      pointerId: 3,
    });
    expect(input.value).toBe("30");
  });

  test("a disabled knob takes no key, wheel or drag, and says so", () => {
    const { control, events, input, thumb } = renderKnob("disabled");
    key(input, "ArrowUp");
    control.dispatchEvent(
      new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: -100 })
    );
    pointer(control, "pointerdown", { clientX: 50, clientY: 0, pointerId: 1 });
    pointer(control, "pointermove", {
      clientX: 100,
      clientY: 50,
      pointerId: 1,
    });
    expect(events.changes).toEqual([]);
    expect(input.disabled).toBe(true);
    expect(thumb.hasAttribute("data-disabled")).toBe(true);
  });

  test("the input event's detail is typed, its target the knob", () => {
    const { input, knob } = renderKnob();
    let seen: KnobInputEvent | undefined;
    knob.addEventListener("input", (event) => {
      seen = event;
    });
    key(input, "ArrowUp");
    expect(seen?.target).toBe(knob);
    expect(seen?.detail).toEqual({ reason: "keyboard", value: 51 });
  });
});
