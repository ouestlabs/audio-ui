import { type XYPadState, xypad } from "@audio-ui/primitives/xypad";
import { createParts, wrappedChild } from "@ui-sdk/web";

/** A thumb's attributes that name its inputs instead, so they are read once. */
const INPUT_NAMES = ["aria-describedby", "aria-labelledby"];

/**
 * The thumb holds two native range inputs, one per axis: they take focus, the
 * keys, the names and the form values. The thumb's `aria-label` names each,
 * followed by "X" or "Y". Their own `input` and `change` events stop at the
 * pad, whose events of those names report the point with a reason.
 */
function renderThumb(thumb: HTMLElement) {
  if (thumb.querySelector("input")) {
    return;
  }
  const label = thumb.getAttribute("aria-label");
  thumb.removeAttribute("aria-label");
  for (const axis of ["x", "y"] as const) {
    const part = document.createElement(`audio-ui-xypad-input-${axis}`);
    const input = document.createElement("input");
    if (label) {
      input.setAttribute("aria-label", `${label} ${axis.toUpperCase()}`);
    }
    for (const name of INPUT_NAMES) {
      const value = thumb.getAttribute(name);
      if (value !== null) {
        input.setAttribute(name, value);
      }
    }
    for (const type of ["input", "change"]) {
      input.addEventListener(type, (event) => event.stopPropagation());
    }
    part.appendChild(input);
    thumb.appendChild(part);
  }
  for (const name of INPUT_NAMES) {
    thumb.removeAttribute(name);
  }
}

/** Writes the value's text as one text node's data, so a change restyles nothing else. */
function writeText(part: Element, text: string) {
  const node =
    part.firstChild instanceof Text
      ? part.firstChild
      : part.appendChild(document.createTextNode(""));
  if (node.data !== text) {
    node.data = text;
  }
}

/**
 * What React renders as children, the pad draws here: the value's text, on
 * every change. The pad connects before its parts are parsed, so it draws
 * again once they bind.
 */
function drawValue(
  el: HTMLElement,
  instance: {
    get: () => object;
    subscribe: (listener: () => void) => () => void;
  }
) {
  const draw = () => {
    const { view } = instance.get() as XYPadState;
    for (const value of el.querySelectorAll("audio-ui-xypad-value")) {
      writeText(value, view.formattedPair);
    }
  };
  draw();
  queueMicrotask(draw);
  return instance.subscribe(draw);
}

const jsonAttribute = (value: string | null) =>
  value ? JSON.parse(value) : undefined;

/** The whole web adapter of the XY pad: a tag for each part, and how attributes read. */
export const parts = createParts(xypad, {
  control: { display: "block", tag: "audio-ui-xypad-control" },
  inputX: {
    display: "contents",
    tag: "audio-ui-xypad-input-x",
    target: wrappedChild("input"),
  },
  inputY: {
    display: "contents",
    tag: "audio-ui-xypad-input-y",
    target: wrappedChild("input"),
  },
  label: { display: "block", tag: "audio-ui-xypad-label" },
  root: {
    api: ["setValue"],
    display: "block",
    events: { onValueChange: "input", onValueCommitted: "change" },
    kinds: {
      defaultValue: jsonAttribute,
      format: jsonAttribute,
      locale: "string",
      value: jsonAttribute,
    },
    render: drawValue,
    state: {
      value: {
        get: (api) => api.controller.getSnapshot().value,
        set: (api, value: { x: number; y: number }) => api.set(value),
      },
    },
    tag: "audio-ui-xypad",
  },
  thumb: { display: "block", render: renderThumb, tag: "audio-ui-xypad-thumb" },
  value: "audio-ui-xypad-value",
});
