import { channelView } from "@audio-ui/core/meter";
import { type MeterState, meter } from "@audio-ui/primitives/meter";
import { createParts } from "@ui-sdk/web";

/** Writes the level's text as one text node's data, so a change restyles nothing else. */
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
 * What React renders as children, the meter draws here: each value part's
 * text, from the levels it holds. A live source writes the text itself, frame
 * by frame. The meter connects before its parts are parsed, so it draws again
 * once they bind.
 */
function drawValues(
  el: HTMLElement,
  instance: {
    get: () => object;
    subscribe: (listener: () => void) => () => void;
  }
) {
  const draw = () => {
    const state = instance.get() as MeterState;
    for (const channel of el.querySelectorAll("audio-ui-meter-channel")) {
      const index = Number(channel.getAttribute("index"));
      const value = channel.querySelector("audio-ui-meter-value");
      if (value) {
        writeText(value, channelView(state.frame, index, state.config).text);
      }
    }
  };
  draw();
  queueMicrotask(draw);
  return instance.subscribe(draw);
}

const jsonAttribute = (value: string | null) =>
  value ? JSON.parse(value) : undefined;

/** The whole web adapter of the meter: a tag for each part, and how attributes read. */
export const parts = createParts(meter, {
  channel: { display: "block", tag: "audio-ui-meter-channel" },
  indicator: { display: "block", tag: "audio-ui-meter-indicator" },
  label: "audio-ui-meter-label",
  mark: "audio-ui-meter-mark",
  peak: { display: "block", tag: "audio-ui-meter-peak" },
  root: {
    display: "block",
    kinds: {
      format: jsonAttribute,
      locale: "string",
      orientation: "string",
      peak: jsonAttribute,
      scale: (value) => value ?? undefined,
      value: jsonAttribute,
    },
    render: drawValues,
    tag: "audio-ui-meter",
  },
  track: { display: "block", tag: "audio-ui-meter-track" },
  value: "audio-ui-meter-value",
});
