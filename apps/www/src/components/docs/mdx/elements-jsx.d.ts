/**
 * The custom elements of `@audio-ui/elements` as JSX tags, for the docs'
 * live previews: React renders them as they are, `className` as `class`,
 * and sets a prop the element defines as a property.
 */
import type { DetailedHTMLProps, HTMLAttributes } from "react";

/** Any attribute or property an element takes, beside the HTML ones. */
type ElementProps = DetailedHTMLProps<
  HTMLAttributes<HTMLElement>,
  HTMLElement
> & {
  [attribute: string]: unknown;
};

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "audio-ui-envelope": ElementProps;
      "audio-ui-envelope-fill": ElementProps;
      "audio-ui-envelope-graph": ElementProps;
      "audio-ui-envelope-line": ElementProps;
      "audio-ui-envelope-point": ElementProps;
      "audio-ui-envelope-points": ElementProps;
      "audio-ui-envelope-segment": ElementProps;
      "audio-ui-envelope-segments": ElementProps;
      "audio-ui-fader": ElementProps;
      "audio-ui-fader-control": ElementProps;
      "audio-ui-fader-indicator": ElementProps;
      "audio-ui-fader-label": ElementProps;
      "audio-ui-fader-thumb": ElementProps;
      "audio-ui-fader-track": ElementProps;
      "audio-ui-fader-value": ElementProps;
      "audio-ui-knob": ElementProps;
      "audio-ui-knob-control": ElementProps;
      "audio-ui-knob-indicator": ElementProps;
      "audio-ui-knob-label": ElementProps;
      "audio-ui-knob-thumb": ElementProps;
      "audio-ui-knob-track": ElementProps;
      "audio-ui-knob-value": ElementProps;
      "audio-ui-meter": ElementProps;
      "audio-ui-meter-channel": ElementProps;
      "audio-ui-meter-channels": ElementProps;
      "audio-ui-meter-indicator": ElementProps;
      "audio-ui-meter-label": ElementProps;
      "audio-ui-meter-mark": ElementProps;
      "audio-ui-meter-peak": ElementProps;
      "audio-ui-meter-track": ElementProps;
      "audio-ui-meter-value": ElementProps;
      "audio-ui-pad": ElementProps;
      "audio-ui-pad-item": ElementProps;
      "audio-ui-piano": ElementProps;
      "audio-ui-piano-key": ElementProps;
      "audio-ui-piano-key-label": ElementProps;
      "audio-ui-piano-keys": ElementProps;
      "audio-ui-piano-roll": ElementProps;
      "audio-ui-piano-roll-grid": ElementProps;
      "audio-ui-piano-roll-keys": ElementProps;
      "audio-ui-piano-roll-marquee": ElementProps;
      "audio-ui-piano-roll-note": ElementProps;
      "audio-ui-piano-roll-note-handle": ElementProps;
      "audio-ui-piano-roll-notes": ElementProps;
      "audio-ui-piano-roll-row": ElementProps;
      "audio-ui-piano-roll-rows": ElementProps;
      "audio-ui-piano-roll-selection-span": ElementProps;
      "audio-ui-piano-roll-stretch-handle": ElementProps;
      "audio-ui-piano-roll-velocities": ElementProps;
      "audio-ui-piano-roll-velocity": ElementProps;
      "audio-ui-piano-roll-velocity-lane": ElementProps;
      "audio-ui-plot": ElementProps;
      "audio-ui-plot-band": ElementProps;
      "audio-ui-plot-cursor": ElementProps;
      "audio-ui-plot-cursor-readout": ElementProps;
      "audio-ui-plot-curve": ElementProps;
      "audio-ui-plot-dot": ElementProps;
      "audio-ui-plot-grid": ElementProps;
      "audio-ui-plot-handle": ElementProps;
      "audio-ui-plot-line": ElementProps;
      "audio-ui-plot-mark": ElementProps;
      "audio-ui-plot-trace": ElementProps;
      "audio-ui-sequencer": ElementProps;
      "audio-ui-sequencer-cell": ElementProps;
      "audio-ui-sequencer-row": ElementProps;
      "audio-ui-sequencer-rows": ElementProps;
      "audio-ui-sequencer-step": ElementProps;
      "audio-ui-sequencer-steps": ElementProps;
      "audio-ui-sequencer-velocity": ElementProps;
      "audio-ui-timeline": ElementProps;
      "audio-ui-timeline-clip": ElementProps;
      "audio-ui-timeline-clip-fade": ElementProps;
      "audio-ui-timeline-clip-fade-handle": ElementProps;
      "audio-ui-timeline-clip-handle": ElementProps;
      "audio-ui-timeline-clip-header": ElementProps;
      "audio-ui-timeline-lane": ElementProps;
      "audio-ui-timeline-mark": ElementProps;
      "audio-ui-timeline-navigator": ElementProps;
      "audio-ui-timeline-navigator-handle": ElementProps;
      "audio-ui-timeline-navigator-window": ElementProps;
      "audio-ui-timeline-playhead": ElementProps;
      "audio-ui-timeline-range": ElementProps;
      "audio-ui-timeline-range-handle": ElementProps;
      "audio-ui-timeline-ruler": ElementProps;
      "audio-ui-timeline-track": ElementProps;
      "audio-ui-timeline-track-header": ElementProps;
      "audio-ui-timeline-track-resize-handle": ElementProps;
      "audio-ui-timeline-viewport": ElementProps;
      "audio-ui-waveform": ElementProps;
      "audio-ui-waveform-bar": ElementProps;
      "audio-ui-waveform-bars": ElementProps;
      "audio-ui-waveform-canvas": ElementProps;
      "audio-ui-waveform-control": ElementProps;
      "audio-ui-waveform-hover": ElementProps;
      "audio-ui-waveform-marker": ElementProps;
      "audio-ui-waveform-playhead": ElementProps;
      "audio-ui-waveform-region": ElementProps;
      "audio-ui-waveform-region-handle": ElementProps;
      "audio-ui-waveform-thumb": ElementProps;
      "audio-ui-xypad": ElementProps;
      "audio-ui-xypad-control": ElementProps;
      "audio-ui-xypad-label": ElementProps;
      "audio-ui-xypad-thumb": ElementProps;
      "audio-ui-xypad-value": ElementProps;
    }
  }
}
