/**
 * Waveform Web Components. Importing this entry point registers its
 * elements. The shape comes from the `peaks` property or a live `levels`
 * source; the position from `value` or a live `source`:
 *
 * ```html
 * <audio-ui-waveform duration="102">
 *   <audio-ui-waveform-control aria-label="Seek">
 *     <audio-ui-waveform-canvas></audio-ui-waveform-canvas>
 *     <audio-ui-waveform-playhead></audio-ui-waveform-playhead>
 *   </audio-ui-waveform-control>
 * </audio-ui-waveform>
 * ```
 */
import { define, structure } from "../internal/element.ts";
import {
  WAVEFORM_TAGS,
  WaveformBarElement,
  WaveformBarsElement,
  WaveformCanvasElement,
  WaveformControlElement,
  WaveformElement,
  WaveformHoverElement,
  WaveformMarkerElement,
  WaveformPlayheadElement,
  WaveformRegionElement,
  WaveformRegionHandleElement,
  WaveformThumbElement,
} from "./elements.ts";

export {
  WAVEFORM_TAGS,
  WaveformBarElement,
  WaveformBarsElement,
  WaveformCanvasElement,
  type WaveformChangeEvent,
  WaveformControlElement,
  type WaveformControlElementEventMap,
  type WaveformDescribe,
  WaveformElement,
  type WaveformElementEventMap,
  type WaveformEventDetail,
  WaveformHoverElement,
  type WaveformInputEvent,
  type WaveformLevelsSource,
  WaveformMarkerElement,
  WaveformPlayheadElement,
  type WaveformPositionSource,
  type WaveformRangeDetail,
  WaveformRegionElement,
  type WaveformRegionElementEventMap,
  WaveformRegionHandleElement,
  WaveformThumbElement,
} from "./elements.ts";

structure(
  `:where(${WAVEFORM_TAGS.root}, ${WAVEFORM_TAGS.canvas}, ${WAVEFORM_TAGS.bars}) { display: block }
:where(${WAVEFORM_TAGS.control}) { display: block; position: relative; touch-action: none }
:where(${WAVEFORM_TAGS.thumb}, ${WAVEFORM_TAGS.playhead}) { display: block; position: absolute; left: var(--waveform-position) }
:where(${WAVEFORM_TAGS.thumb}) { transform: translateX(-50%) }
:where(${WAVEFORM_TAGS.hover}, ${WAVEFORM_TAGS.marker}) { display: block; position: absolute }
:where(${WAVEFORM_TAGS.region}) { display: block; position: absolute; touch-action: none }
:where(${WAVEFORM_TAGS.regionHandle}) { display: block; touch-action: none }
:where(${WAVEFORM_TAGS.bar}) { display: block }`
);

// The waveform first, so a part that connects finds it upgraded; the region before its handles.
define({
  [WAVEFORM_TAGS.root]: WaveformElement,
  [WAVEFORM_TAGS.control]: WaveformControlElement,
  [WAVEFORM_TAGS.canvas]: WaveformCanvasElement,
  [WAVEFORM_TAGS.bars]: WaveformBarsElement,
  [WAVEFORM_TAGS.bar]: WaveformBarElement,
  [WAVEFORM_TAGS.thumb]: WaveformThumbElement,
  [WAVEFORM_TAGS.playhead]: WaveformPlayheadElement,
  [WAVEFORM_TAGS.hover]: WaveformHoverElement,
  [WAVEFORM_TAGS.marker]: WaveformMarkerElement,
  [WAVEFORM_TAGS.region]: WaveformRegionElement,
  [WAVEFORM_TAGS.regionHandle]: WaveformRegionHandleElement,
});

declare global {
  interface HTMLElementTagNameMap {
    "audio-ui-waveform": WaveformElement;
    "audio-ui-waveform-bar": WaveformBarElement;
    "audio-ui-waveform-bars": WaveformBarsElement;
    "audio-ui-waveform-canvas": WaveformCanvasElement;
    "audio-ui-waveform-control": WaveformControlElement;
    "audio-ui-waveform-hover": WaveformHoverElement;
    "audio-ui-waveform-marker": WaveformMarkerElement;
    "audio-ui-waveform-playhead": WaveformPlayheadElement;
    "audio-ui-waveform-region": WaveformRegionElement;
    "audio-ui-waveform-region-handle": WaveformRegionHandleElement;
    "audio-ui-waveform-thumb": WaveformThumbElement;
  }
}
