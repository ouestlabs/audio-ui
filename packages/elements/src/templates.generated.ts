// Written by `bun scripts/templates.ts` from the elements themselves. Do not edit.
import type {
  EnvelopeElementEventMap,
  FaderElementEventMap,
  KnobElementEventMap,
  PadElementEventMap,
  PianoElementEventMap,
  PianoRollElementEventMap,
  PlotHandleElementEventMap,
  SequencerElementEventMap,
  TimelineClipElementEventMap,
  TimelineElementEventMap,
  TimelineLaneElementEventMap,
  TimelineMarkElementEventMap,
  TimelineRangeElementEventMap,
  TimelineTrackElementEventMap,
  WaveformControlElementEventMap,
  WaveformElementEventMap,
  WaveformRegionElementEventMap,
  XYPadElementEventMap,
} from "./index.ts";

/** What a template can give each element, and hear from it: the attributes it observes, the properties it has a setter for, and its events. */
export interface ElementTemplates {
  "audio-ui-envelope": {
    attributes: "default-value" | "disabled" | "format" | "locale" | "max-points" | "min-points" | "snap" | "step" | "value";
    events: EnvelopeElementEventMap;
    properties: "format" | "value";
  };
  "audio-ui-envelope-fill": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-envelope-graph": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-envelope-line": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-envelope-point": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: "index";
  };
  "audio-ui-envelope-points": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-envelope-segment": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: "index";
  };
  "audio-ui-envelope-segments": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-fader": {
    attributes: "anchor" | "default-value" | "disabled" | "format" | "large-step" | "locale" | "max" | "min" | "name" | "orientation" | "step" | "value";
    events: FaderElementEventMap;
    properties: "format" | "value";
  };
  "audio-ui-fader-control": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-fader-indicator": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-fader-label": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-fader-thumb": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-fader-track": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-fader-value": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-knob": {
    attributes: "anchor" | "default-value" | "disabled" | "drag-mode" | "format" | "large-step" | "locale" | "max" | "min" | "name" | "scale" | "step" | "value";
    events: KnobElementEventMap;
    properties: "format" | "scale" | "value";
  };
  "audio-ui-knob-control": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-knob-indicator": {
    attributes: "stroke-width";
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-knob-label": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-knob-thumb": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-knob-track": {
    attributes: "stroke-width";
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-knob-value": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-meter": {
    attributes: "clip-threshold" | "format" | "locale" | "max" | "min" | "orientation" | "peak" | "scale" | "unit" | "value" | "warn-threshold";
    events: HTMLElementEventMap;
    properties: "format" | "peak" | "scale" | "source" | "value";
  };
  "audio-ui-meter-channel": {
    attributes: "index";
    events: HTMLElementEventMap;
    properties: "index";
  };
  "audio-ui-meter-channels": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-meter-indicator": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-meter-label": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-meter-mark": {
    attributes: "value";
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-meter-peak": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-meter-track": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-meter-value": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-pad": {
    attributes: "active-pads" | "columns" | "disabled";
    events: PadElementEventMap;
    properties: "activePads";
  };
  "audio-ui-pad-item": {
    attributes: "choke-group" | "disabled" | "value";
    events: HTMLElementEventMap;
    properties: "value";
  };
  "audio-ui-piano": {
    attributes: "active-notes" | "disabled" | "layout" | "max-pitch" | "min-pitch" | "orientation" | "pitches";
    events: PianoElementEventMap;
    properties: "activeNotes" | "pitches";
  };
  "audio-ui-piano-key": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-piano-key-label": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-piano-keys": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-piano-roll": {
    attributes: "active-pitches" | "disabled" | "draw-style" | "folded" | "max-pitch" | "min-length" | "min-pitch" | "mode" | "scale" | "scale-root";
    events: PianoRollElementEventMap;
    properties: "scale" | "selection" | "value";
  };
  "audio-ui-piano-roll-grid": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-piano-roll-keys": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-piano-roll-marquee": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-piano-roll-note": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-piano-roll-note-handle": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-piano-roll-notes": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-piano-roll-row": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-piano-roll-rows": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-piano-roll-selection-span": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-piano-roll-stretch-handle": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-piano-roll-velocities": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-piano-roll-velocity": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-piano-roll-velocity-lane": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-plot": {
    attributes: "disabled" | "max-x" | "max-y" | "min-x" | "min-y" | "scale-x" | "scale-y";
    events: HTMLElementEventMap;
    properties: "scaleX" | "scaleY";
  };
  "audio-ui-plot-band": {
    attributes: "axis" | "from" | "to";
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-plot-cursor": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-plot-cursor-readout": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: "format";
  };
  "audio-ui-plot-curve": {
    attributes: "fill-to" | "samples";
    events: HTMLElementEventMap;
    properties: "fn";
  };
  "audio-ui-plot-dot": {
    attributes: "value";
    events: HTMLElementEventMap;
    properties: "source";
  };
  "audio-ui-plot-grid": {
    attributes: "axis" | "labels" | "x-count" | "x-ticks" | "y-count" | "y-ticks";
    events: HTMLElementEventMap;
    properties: "format";
  };
  "audio-ui-plot-handle": {
    attributes: "axis" | "default-value" | "disabled" | "label-x" | "label-y" | "value";
    events: PlotHandleElementEventMap;
    properties: "value";
  };
  "audio-ui-plot-line": {
    attributes: "axis" | "value";
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-plot-mark": {
    attributes: "axis" | "value";
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-plot-trace": {
    attributes: "fill-to" | "max" | "min";
    events: HTMLElementEventMap;
    properties: "source";
  };
  "audio-ui-sequencer": {
    attributes: "default-value" | "disabled" | "value";
    events: SequencerElementEventMap;
    properties: "defaultVelocities" | "source" | "value" | "velocities";
  };
  "audio-ui-sequencer-cell": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-sequencer-row": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: "index";
  };
  "audio-ui-sequencer-rows": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-sequencer-step": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-sequencer-steps": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-sequencer-velocity": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-timeline": {
    attributes: "default-position" | "default-zoom" | "disabled" | "duration" | "large-step" | "max-zoom" | "min-zoom" | "position" | "snap-offset" | "snap-points" | "snap-step" | "step" | "zoom";
    events: TimelineElementEventMap;
    properties: "position" | "snapPoints" | "source" | "zoom";
  };
  "audio-ui-timeline-clip": {
    attributes: "additive" | "disabled" | "fade-in" | "fade-in-shape" | "fade-out" | "fade-out-shape" | "length" | "min-length" | "movable" | "offset" | "selected" | "source-length" | "start";
    events: TimelineClipElementEventMap;
    properties: "value";
  };
  "audio-ui-timeline-clip-fade": {
    attributes: "edge";
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-timeline-clip-fade-handle": {
    attributes: "edge";
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-timeline-clip-handle": {
    attributes: "edge";
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-timeline-clip-header": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-timeline-lane": {
    attributes: never;
    events: TimelineLaneElementEventMap;
    properties: never;
  };
  "audio-ui-timeline-mark": {
    attributes: "movable" | "step" | "value";
    events: TimelineMarkElementEventMap;
    properties: "value";
  };
  "audio-ui-timeline-navigator": {
    attributes: "min-window-width";
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-timeline-navigator-handle": {
    attributes: "edge";
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-timeline-navigator-window": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-timeline-playhead": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-timeline-range": {
    attributes: "default-value" | "disabled" | "drawable" | "min-drawn-width" | "min-length" | "movable" | "value";
    events: TimelineRangeElementEventMap;
    properties: "value";
  };
  "audio-ui-timeline-range-handle": {
    attributes: "edge";
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-timeline-ruler": {
    attributes: "selectable";
    events: TimelineLaneElementEventMap;
    properties: never;
  };
  "audio-ui-timeline-track": {
    attributes: "height" | "large-step" | "max-height" | "min-height" | "selected" | "step";
    events: TimelineTrackElementEventMap;
    properties: "height";
  };
  "audio-ui-timeline-track-header": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-timeline-track-resize-handle": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-timeline-viewport": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-waveform": {
    attributes: "default-value" | "disabled" | "duration" | "large-step" | "loading" | "range" | "step" | "value";
    events: WaveformElementEventMap;
    properties: "levels" | "peaks" | "range" | "source" | "value";
  };
  "audio-ui-waveform-bar": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-waveform-bars": {
    attributes: "count" | "gain" | "idle" | "min-level" | "mirrored";
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-waveform-canvas": {
    attributes: "bar-gap" | "bar-radius" | "bar-width" | "gain" | "idle" | "line-width" | "min-bar-height" | "mirrored" | "mode" | "scroll-speed" | "variant";
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-waveform-control": {
    attributes: "selectable";
    events: WaveformControlElementEventMap;
    properties: never;
  };
  "audio-ui-waveform-hover": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: "format";
  };
  "audio-ui-waveform-marker": {
    attributes: "value";
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-waveform-playhead": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-waveform-region": {
    attributes: "default-value" | "disabled" | "min-length" | "movable" | "value";
    events: WaveformRegionElementEventMap;
    properties: "value";
  };
  "audio-ui-waveform-region-handle": {
    attributes: "edge";
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-waveform-thumb": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-xypad": {
    attributes: "default-value" | "disabled" | "format" | "locale" | "max-x" | "max-y" | "min-x" | "min-y" | "name" | "step-x" | "step-y" | "value";
    events: XYPadElementEventMap;
    properties: "format" | "value";
  };
  "audio-ui-xypad-control": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-xypad-label": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-xypad-thumb": {
    attributes: "label-x" | "label-y";
    events: HTMLElementEventMap;
    properties: never;
  };
  "audio-ui-xypad-value": {
    attributes: never;
    events: HTMLElementEventMap;
    properties: never;
  };
}
