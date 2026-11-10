/**
 * The custom elements of `@audio-ui/elements` as JSX tags, for the docs'
 * live preview: React renders them as they are, `className` as `class`.
 */
import type { DetailedHTMLProps, HTMLAttributes } from "react";

type Part = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;

/** The attributes every control takes, as their HTML spells them. */
interface ControlAttributes {
  anchor?: number | string;
  "default-value"?: number | string;
  disabled?: boolean;
  format?: string;
  "large-step"?: number | string;
  locale?: string;
  max?: number | string;
  min?: number | string;
  name?: string;
  step?: number | string;
  value?: number | string;
}

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "audio-ui-fader": Part &
        ControlAttributes & { orientation?: "horizontal" | "vertical" };
      "audio-ui-fader-control": Part;
      "audio-ui-fader-indicator": Part;
      "audio-ui-fader-label": Part;
      "audio-ui-fader-thumb": Part;
      "audio-ui-fader-track": Part;
      "audio-ui-fader-value": Part;
      "audio-ui-knob": Part &
        ControlAttributes & {
          "drag-mode"?: "circular" | "revolution" | "vertical";
          scale?: "linear" | "log";
        };
      "audio-ui-knob-control": Part;
      "audio-ui-knob-indicator": Part & { "stroke-width"?: number | string };
      "audio-ui-knob-label": Part;
      "audio-ui-knob-thumb": Part;
      "audio-ui-knob-track": Part & { "stroke-width"?: number | string };
      "audio-ui-knob-value": Part;
    }
  }
}
