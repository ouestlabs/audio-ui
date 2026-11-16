import { type FaderState, fader } from "@audio-ui/primitives/fader";
import { createParts, wrappedChild } from "@ui-sdk/web";

/** A thumb's attributes that name its input instead, so they are read once. */
const INPUT_NAMES = ["aria-describedby", "aria-label", "aria-labelledby"];

/**
 * The thumb holds the native range input, which takes focus, the keys, the
 * name and the form value. Its own `input` and `change` events stop at the
 * fader, whose events of those names report the value with a reason.
 */
function renderThumb(thumb: HTMLElement) {
  if (thumb.querySelector("input")) {
    return;
  }
  const part = document.createElement("audio-ui-fader-input");
  const input = document.createElement("input");
  for (const name of INPUT_NAMES) {
    const value = thumb.getAttribute(name);
    if (value !== null) {
      input.setAttribute(name, value);
      thumb.removeAttribute(name);
    }
  }
  for (const type of ["input", "change"]) {
    input.addEventListener(type, (event) => event.stopPropagation());
  }
  part.appendChild(input);
  thumb.appendChild(part);
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
 * What React renders as children, the fader draws here: the value's text,
 * on every change. The fader connects before its parts are parsed, so it
 * draws again once they bind.
 */
function drawValue(
  el: HTMLElement,
  instance: {
    get: () => object;
    subscribe: (listener: () => void) => () => void;
  }
) {
  const draw = () => {
    const { view } = instance.get() as FaderState;
    for (const value of el.querySelectorAll("audio-ui-fader-value")) {
      writeText(value, view.formatted);
    }
  };
  draw();
  queueMicrotask(draw);
  return instance.subscribe(draw);
}

const jsonAttribute = (value: string | null) =>
  value ? JSON.parse(value) : undefined;

/** The whole web adapter of the fader: a tag for each part, and how attributes read. */
export const parts = createParts(fader, {
  control: { display: "block", tag: "audio-ui-fader-control" },
  indicator: { display: "block", tag: "audio-ui-fader-indicator" },
  input: {
    display: "contents",
    tag: "audio-ui-fader-input",
    target: wrappedChild("input"),
  },
  label: { display: "block", tag: "audio-ui-fader-label" },
  mark: "audio-ui-fader-mark",
  root: {
    api: ["setValue"],
    display: "block",
    events: { onValueChange: "input", onValueCommitted: "change" },
    kinds: {
      format: jsonAttribute,
      locale: "string",
      orientation: "string",
    },
    render: drawValue,
    state: {
      value: {
        get: (api) => api.controller.getSnapshot().value,
        set: (api, value: number) => api.set(value),
      },
    },
    tag: "audio-ui-fader",
  },
  thumb: { display: "block", render: renderThumb, tag: "audio-ui-fader-thumb" },
  track: { display: "block", tag: "audio-ui-fader-track" },
  value: "audio-ui-fader-value",
});
