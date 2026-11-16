import { pad } from "@audio-ui/primitives/pad";
import { createParts, wrappedButton } from "@ui-sdk/web";

/**
 * The whole web adapter of the pad grid: a tag for each part. A pad's own
 * element is a wrapper, and the button inside it is the pad: it takes the
 * focus, the keys and the state attributes.
 */
export const parts = createParts(pad, {
  item: {
    display: "contents",
    tag: "audio-ui-pad-item",
    target: wrappedButton,
  },
  root: {
    display: "block",
    events: { onPadOff: "padoff", onPadOn: "padon" },
    kinds: { activePads: (value) => (value ? JSON.parse(value) : undefined) },
    tag: "audio-ui-pad",
  },
});
