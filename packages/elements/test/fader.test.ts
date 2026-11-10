import { describe, expect, test } from "bun:test";
import "../src/fader/index.ts";
import type { FaderElement } from "../src/fader/index.ts";
import { key, listen, mockRect, pointer } from "./helpers.ts";

/** A fader with its audio defaults, -60 to +6 dB, vertical, so it starts at -27. */
function renderFader(attributes = "", thumb = 'aria-label="Volume"') {
  document.body.innerHTML = `
    <audio-ui-fader ${attributes}>
      <audio-ui-fader-control>
        <audio-ui-fader-track>
          <audio-ui-fader-indicator></audio-ui-fader-indicator>
          <audio-ui-fader-thumb ${thumb}></audio-ui-fader-thumb>
        </audio-ui-fader-track>
      </audio-ui-fader-control>
      <audio-ui-fader-value></audio-ui-fader-value>
    </audio-ui-fader>`;
  const fader = document.querySelector("audio-ui-fader") as FaderElement;
  const thumbElement = fader.querySelector(
    "audio-ui-fader-thumb"
  ) as HTMLElement;
  return {
    control: fader.querySelector("audio-ui-fader-control") as HTMLElement,
    events: listen(fader),
    fader,
    indicator: fader.querySelector("audio-ui-fader-indicator") as HTMLElement,
    input: thumbElement.querySelector("input") as HTMLInputElement,
    thumb: thumbElement,
    value: fader.querySelector("audio-ui-fader-value") as HTMLElement,
  };
}

describe("the fader's value", () => {
  test("defaults to the midpoint, vertical, with an accessible native input", () => {
    const { fader, input, thumb } = renderFader();
    expect(input.type).toBe("range");
    expect(input.value).toBe("-27");
    expect(input.getAttribute("aria-label")).toBe("Volume");
    expect(input.getAttribute("aria-orientation")).toBe("vertical");
    expect(thumb.hasAttribute("aria-label")).toBe(false);
    expect(fader.getAttribute("role")).toBe("group");
    expect(fader.getAttribute("data-orientation")).toBe("vertical");
  });

  test("starts at default-value, and formats aria-valuetext and the value part", () => {
    expect(renderFader('default-value="-6"').input.value).toBe("-6");
    const { input, value } = renderFader(
      `value="-6" locale="en-US" format='{"maximumFractionDigits":1,"minimumFractionDigits":1}'`
    );
    expect(input.getAttribute("aria-valuetext")).toBe("-6.0");
    expect(value.textContent).toBe("-6.0");
  });

  test("a label names the group and the input when the thumb has no name of its own", () => {
    document.body.innerHTML = `
      <audio-ui-fader>
        <audio-ui-fader-label>Gain</audio-ui-fader-label>
        <audio-ui-fader-control><audio-ui-fader-thumb></audio-ui-fader-thumb></audio-ui-fader-control>
      </audio-ui-fader>`;
    const label = document.querySelector("audio-ui-fader-label") as HTMLElement;
    const fader = document.querySelector("audio-ui-fader") as HTMLElement;
    const input = document.querySelector("input") as HTMLInputElement;
    expect(fader.getAttribute("aria-labelledby")).toBe(label.id);
    expect(input.getAttribute("aria-labelledby")).toBe(label.id);
  });

  test("the thumb sits along the travel at its value, from the bottom when vertical, from the start when horizontal", () => {
    expect(renderFader('value="-27"').thumb.style.bottom).toBe("50%");
    const horizontal = renderFader('orientation="horizontal" value="6"');
    expect(horizontal.thumb.style.insetInlineStart).toBe("100%");
    expect(horizontal.input.getAttribute("aria-orientation")).toBe(
      "horizontal"
    );
  });

  test("the indicator fills from the anchor, on whichever side of it the value is", () => {
    const above = renderFader(
      'anchor="0" min="-1" max="1" step="0.1" value="0.5"'
    );
    expect(above.indicator.style.bottom).toBe("50%");
    expect(above.indicator.style.height).toBe("25%");
    const below = renderFader(
      'anchor="0" min="-1" max="1" step="0.1" value="-0.5"'
    );
    expect(below.indicator.style.bottom).toBe("25%");
    expect(below.indicator.style.height).toBe("25%");
  });

  test("its name and value go to a form", () => {
    document.body.innerHTML = `
      <form>
        <audio-ui-fader name="volume" value="-6">
          <audio-ui-fader-control><audio-ui-fader-thumb aria-label="Volume"></audio-ui-fader-thumb></audio-ui-fader-control>
        </audio-ui-fader>
      </form>`;
    const form = document.querySelector("form") as HTMLFormElement;
    expect(new FormData(form).get("volume")).toBe("-6");
  });
});

describe("moving the fader", () => {
  test("ArrowUp reports an input and a change with a keyboard reason", () => {
    const { events, input } = renderFader();
    expect(key(input, "ArrowUp").defaultPrevented).toBe(true);
    expect(input.value).toBe("-26");
    expect(events.changes).toEqual([[-26, "keyboard"]]);
    expect(events.commits).toEqual([[-26, "keyboard"]]);
  });

  test("the wheel steps with a wheel reason", () => {
    const { control, events } = renderFader();
    control.dispatchEvent(
      new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: -100 })
    );
    expect(events.changes).toEqual([[-26, "wheel"]]);
  });

  test("a press on the track jumps to the value under it, a drag follows, the release commits", () => {
    const { control, events } = renderFader();
    mockRect(control, { bottom: 200, height: 200, right: 20, width: 20 });
    pointer(control, "pointerdown", { clientX: 10, clientY: 0, pointerId: 1 });
    expect(events.changes.at(-1)).toEqual([6, "track-press"]);
    pointer(document.body, "pointermove", {
      buttons: 1,
      clientX: 10,
      clientY: 100,
      pointerId: 1,
    });
    expect(events.changes.at(-1)).toEqual([-27, "drag"]);
    pointer(document.body, "pointerup", {
      clientX: 10,
      clientY: 100,
      pointerId: 1,
    });
    expect(events.commits.at(-1)?.[0]).toBe(-27);
  });

  test("a press on the thumb drags from where it was taken, without a jump", () => {
    const { control, events, thumb } = renderFader();
    mockRect(control, { bottom: 200, height: 200, right: 20, width: 20 });
    // The thumb at -27 sits in the middle of the travel.
    mockRect(thumb, { bottom: 110, height: 20, right: 20, top: 90, width: 20 });
    pointer(thumb, "pointerdown", { clientX: 10, clientY: 95, pointerId: 1 });
    expect(events.changes).toEqual([]);
    pointer(document.body, "pointermove", {
      buttons: 1,
      clientX: 10,
      clientY: 75,
      pointerId: 1,
    });
    // 20 px up from where it was taken: a tenth of the travel, +6.6, on the grid.
    expect(events.changes.at(-1)?.[0]).toBe(-20);
    pointer(document.body, "pointerup", { pointerId: 1 });
  });

  test("a double click, an Alt + click and the Delete key return to the default", () => {
    const { control, events, input } = renderFader('default-value="0"');
    key(input, "End");
    control.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(input.value).toBe("0");
    expect(events.commits.at(-1)).toEqual([0, "reset"]);
    key(input, "End");
    pointer(control, "pointerdown", {
      altKey: true,
      clientX: 10,
      clientY: 0,
      pointerId: 2,
    });
    expect(input.value).toBe("0");
    key(input, "End");
    key(input, "Delete");
    expect(input.value).toBe("0");
  });

  test("a canceled input event refuses the value; a value set from outside is where the next key starts", () => {
    const { events, fader, input } = renderFader();
    const refuse = (event: Event) => event.preventDefault();
    fader.addEventListener("input", refuse);
    key(input, "ArrowUp");
    expect(input.value).toBe("-27");
    expect(events.commits).toEqual([]);
    fader.removeEventListener("input", refuse);
    fader.value = -12;
    key(input, "ArrowUp");
    fader.setAttribute("large-step", "6");
    expect(fader.value).toBe(-11);
  });

  test("a disabled fader takes no key, wheel or press, and says so", () => {
    const { control, events, input, thumb } = renderFader("disabled");
    key(input, "ArrowUp");
    control.dispatchEvent(
      new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: -100 })
    );
    pointer(control, "pointerdown", { clientX: 10, clientY: 0, pointerId: 1 });
    expect(events.changes).toEqual([]);
    expect(input.disabled).toBe(true);
    expect(thumb.hasAttribute("data-disabled")).toBe(true);
  });

  test("every part carries data-dragging while a pointer drags", () => {
    const { control, fader, thumb } = renderFader();
    mockRect(control, { bottom: 200, height: 200, right: 20, width: 20 });
    pointer(control, "pointerdown", { clientX: 10, clientY: 50, pointerId: 1 });
    expect(fader.hasAttribute("data-dragging")).toBe(true);
    expect(thumb.hasAttribute("data-dragging")).toBe(true);
    pointer(document.body, "pointerup", { pointerId: 1 });
    expect(thumb.hasAttribute("data-dragging")).toBe(false);
  });
});
