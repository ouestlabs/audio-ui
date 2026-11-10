/**
 * Plot Web Components. Importing this entry point registers its elements.
 * Each drawing part renders its own SVG over the plot; curves take their
 * function, and traces their live source, as properties:
 *
 * ```html
 * <audio-ui-plot min-x="20" max-x="20000" scale-x="log" min-y="-24" max-y="24">
 *   <audio-ui-plot-grid></audio-ui-plot-grid>
 *   <audio-ui-plot-line axis="y" value="0"></audio-ui-plot-line>
 *   <audio-ui-plot-curve></audio-ui-plot-curve>
 *   <audio-ui-plot-handle aria-label="Low" value="200 6"></audio-ui-plot-handle>
 * </audio-ui-plot>
 * ```
 */
import { define, structure } from "../internal/element.ts";
import {
  PLOT_TAGS,
  PlotBandElement,
  PlotCursorElement,
  PlotCursorReadoutElement,
  PlotCurveElement,
  PlotDotElement,
  PlotElement,
  PlotGridElement,
  PlotHandleElement,
  PlotLineElement,
  PlotMarkElement,
  PlotTraceElement,
} from "./elements.ts";

export {
  PLOT_TAGS,
  PlotBandElement,
  PlotCursorElement,
  PlotCursorReadoutElement,
  PlotCurveElement,
  PlotDotElement,
  type PlotDotSource,
  PlotElement,
  PlotGridElement,
  type PlotHandleChangeEvent,
  PlotHandleElement,
  type PlotHandleElementEventMap,
  type PlotHandleEventDetail,
  type PlotHandleInputEvent,
  PlotLineElement,
  PlotMarkElement,
  type PlotSnapshot,
  PlotTraceElement,
  type PlotTraceSource,
} from "./elements.ts";

structure(
  `:where(${PLOT_TAGS.root}) { display: block; position: relative; contain: layout style }
:where(${PLOT_TAGS.curve}, ${PLOT_TAGS.line}, ${PLOT_TAGS.band}, ${PLOT_TAGS.trace}, ${PLOT_TAGS.grid}, ${PLOT_TAGS.cursor}) { display: block; position: absolute; inset: 0; pointer-events: none }
:where(${PLOT_TAGS.mark}, ${PLOT_TAGS.dot}) { display: block; position: absolute; pointer-events: none }
:where(${PLOT_TAGS.dot}, ${PLOT_TAGS.handle}) { translate: -50% -50% }
:where(${PLOT_TAGS.handle}) { display: block; position: absolute; touch-action: none }
:where(${PLOT_TAGS.cursorReadout}) { display: block; position: absolute; left: var(--plot-cursor-x); top: var(--plot-cursor-y) }`
);

// The plot first, so a part that connects finds it upgraded; the cursor before its readout.
define({
  [PLOT_TAGS.root]: PlotElement,
  [PLOT_TAGS.grid]: PlotGridElement,
  [PLOT_TAGS.band]: PlotBandElement,
  [PLOT_TAGS.line]: PlotLineElement,
  [PLOT_TAGS.curve]: PlotCurveElement,
  [PLOT_TAGS.trace]: PlotTraceElement,
  [PLOT_TAGS.mark]: PlotMarkElement,
  [PLOT_TAGS.dot]: PlotDotElement,
  [PLOT_TAGS.handle]: PlotHandleElement,
  [PLOT_TAGS.cursor]: PlotCursorElement,
  [PLOT_TAGS.cursorReadout]: PlotCursorReadoutElement,
});

declare global {
  interface HTMLElementTagNameMap {
    "audio-ui-plot": PlotElement;
    "audio-ui-plot-band": PlotBandElement;
    "audio-ui-plot-cursor": PlotCursorElement;
    "audio-ui-plot-cursor-readout": PlotCursorReadoutElement;
    "audio-ui-plot-curve": PlotCurveElement;
    "audio-ui-plot-dot": PlotDotElement;
    "audio-ui-plot-grid": PlotGridElement;
    "audio-ui-plot-handle": PlotHandleElement;
    "audio-ui-plot-line": PlotLineElement;
    "audio-ui-plot-mark": PlotMarkElement;
    "audio-ui-plot-trace": PlotTraceElement;
  }
}
