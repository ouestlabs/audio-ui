import { piano } from "@audio-ui/primitives/piano";
import { createParts } from "@ui-sdk/vue/primitive";
import { defineComponent, h } from "vue";

/** Which element each part is. */
const parts = createParts(piano, { key: "button", label: "span", root: "div" });

/** The name of the key it sits in, such as "C4", unless it has content of its own. */
const Label = defineComponent(
  (_props, { attrs, slots }) =>
    () =>
      h(parts.Label, attrs, {
        default:
          slots.default ??
          (({ state }: { state: { name: string } }) => state.name),
      }),
  { inheritAttrs: false, name: "PianoLabel" }
);

/**
 * The keys are written by the app, one for each pitch: the Root's default
 * slot gets its state, whose `pitches` lists them, lowest first.
 */
export const Piano = { Key: parts.Key, Label, Root: parts.Root };
