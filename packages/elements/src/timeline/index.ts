/**
 * Timeline Web Components. Importing this entry point registers its
 * elements. Lanes hold the placed parts; the viewport scrolls and zooms
 * them:
 *
 * ```html
 * <audio-ui-timeline duration="32" snap-step="1">
 *   <audio-ui-timeline-viewport>
 *     <audio-ui-timeline-ruler aria-label="Position"></audio-ui-timeline-ruler>
 *     <audio-ui-timeline-track>
 *       <audio-ui-timeline-track-header>Drums</audio-ui-timeline-track-header>
 *       <audio-ui-timeline-lane seekable>
 *         <audio-ui-timeline-clip aria-label="Beat" start="4" length="8">
 *           <audio-ui-timeline-clip-header>Beat</audio-ui-timeline-clip-header>
 *         </audio-ui-timeline-clip>
 *         <audio-ui-timeline-playhead></audio-ui-timeline-playhead>
 *       </audio-ui-timeline-lane>
 *     </audio-ui-timeline-track>
 *   </audio-ui-timeline-viewport>
 * </audio-ui-timeline>
 * ```
 */
import { define, structure } from "../internal/element.ts";
import {
  TimelineClipElement,
  TimelineClipFadeElement,
  TimelineClipFadeHandleElement,
  TimelineClipHandleElement,
  TimelineClipHeaderElement,
} from "./clip.ts";
import {
  TimelineLaneElement,
  TimelineMarkElement,
  TimelineNavigatorElement,
  TimelineNavigatorHandleElement,
  TimelineNavigatorWindowElement,
  TimelinePlayheadElement,
  TimelineRulerElement,
  TimelineViewportElement,
} from "./lanes.ts";
import { TimelineRangeElement, TimelineRangeHandleElement } from "./range.ts";
import { TIMELINE_TAGS, TimelineElement } from "./root.ts";
import {
  TimelineTrackElement,
  TimelineTrackHeaderElement,
  TimelineTrackResizeHandleElement,
} from "./track.ts";

export {
  TimelineClipElement,
  type TimelineClipElementEventMap,
  type TimelineClipEventDetail,
  TimelineClipFadeElement,
  TimelineClipFadeHandleElement,
  TimelineClipHandleElement,
  TimelineClipHeaderElement,
} from "./clip.ts";
export {
  TimelineLaneElement,
  type TimelineLaneElementEventMap,
  TimelineMarkElement,
  type TimelineMarkElementEventMap,
  TimelineNavigatorElement,
  TimelineNavigatorHandleElement,
  TimelineNavigatorWindowElement,
  TimelinePlayheadElement,
  TimelineRulerElement,
  TimelineViewportElement,
} from "./lanes.ts";
export {
  TimelineRangeElement,
  type TimelineRangeElementEventMap,
  type TimelineRangeEventDetail,
  TimelineRangeHandleElement,
} from "./range.ts";
export {
  TIMELINE_TAGS,
  type TimelineChangeEvent,
  type TimelineDescribe,
  TimelineElement,
  type TimelineElementEventMap,
  type TimelineEventDetail,
  type TimelineInputEvent,
  type TimelineSettings,
  type TimelineZoomEvent,
  type ViewportMetrics,
} from "./root.ts";
export {
  TimelineTrackElement,
  type TimelineTrackElementEventMap,
  TimelineTrackHeaderElement,
  TimelineTrackResizeHandleElement,
} from "./track.ts";

const T = TIMELINE_TAGS;
const placed = "left: calc(var(--timeline-unit) * var(--timeline-offset))";
const spans = "width: calc(var(--timeline-unit) * var(--timeline-length))";

structure(
  `:where(${T.root}, ${T.navigatorWindow}, ${T.navigatorHandle}, ${T.rangeHandle}, ${T.clipHandle}, ${T.clipHeader}) { display: block }
:where(${T.viewport}) { display: block; overflow-x: auto }
:where(${T.lane}, ${T.ruler}) { display: block; position: relative; contain: layout style; overflow-x: clip }
:where(${T.ruler}, ${T.navigatorHandle}, ${T.rangeHandle}, ${T.clipHandle}, ${T.clipHeader}) { touch-action: none }
:where(${T.playhead}, ${T.mark}) { display: block; position: absolute; ${placed} }
:where(${T.range}, ${T.clip}) { display: block; position: absolute; touch-action: none; ${placed}; ${spans} }
:where(${T.navigator}) { display: block; position: relative; touch-action: none }
:where(${T.navigatorWindow}, ${T.navigatorHandle}) { position: absolute }
:where(${T.track}) { display: flex; min-width: 100% }
:where(${T.trackHeader}) { display: block; flex-shrink: 0; position: sticky; left: 0; z-index: var(--timeline-track-header-z, 20) }
:where(${T.lane}) { flex: 1 }
:where(${T.trackResizeHandle}) { display: block; touch-action: none }
:where(${T.clipFade}) { display: block; position: absolute; top: 0; bottom: 0; height: 100%; pointer-events: none }
:where(${T.clipFadeHandle}) { display: block; position: absolute; touch-action: none }`
);

// The timeline first, so a part that connects finds it upgraded; each part's own whole before its pieces.
define({
  [T.root]: TimelineElement,
  [T.viewport]: TimelineViewportElement,
  [T.navigator]: TimelineNavigatorElement,
  [T.navigatorWindow]: TimelineNavigatorWindowElement,
  [T.navigatorHandle]: TimelineNavigatorHandleElement,
  [T.track]: TimelineTrackElement,
  [T.trackHeader]: TimelineTrackHeaderElement,
  [T.trackResizeHandle]: TimelineTrackResizeHandleElement,
  [T.lane]: TimelineLaneElement,
  [T.ruler]: TimelineRulerElement,
  [T.playhead]: TimelinePlayheadElement,
  [T.mark]: TimelineMarkElement,
  [T.range]: TimelineRangeElement,
  [T.rangeHandle]: TimelineRangeHandleElement,
  [T.clip]: TimelineClipElement,
  [T.clipHeader]: TimelineClipHeaderElement,
  [T.clipHandle]: TimelineClipHandleElement,
  [T.clipFade]: TimelineClipFadeElement,
  [T.clipFadeHandle]: TimelineClipFadeHandleElement,
});

declare global {
  interface HTMLElementTagNameMap {
    "audio-ui-timeline": TimelineElement;
    "audio-ui-timeline-clip": TimelineClipElement;
    "audio-ui-timeline-clip-fade": TimelineClipFadeElement;
    "audio-ui-timeline-clip-fade-handle": TimelineClipFadeHandleElement;
    "audio-ui-timeline-clip-handle": TimelineClipHandleElement;
    "audio-ui-timeline-clip-header": TimelineClipHeaderElement;
    "audio-ui-timeline-lane": TimelineLaneElement;
    "audio-ui-timeline-mark": TimelineMarkElement;
    "audio-ui-timeline-navigator": TimelineNavigatorElement;
    "audio-ui-timeline-navigator-handle": TimelineNavigatorHandleElement;
    "audio-ui-timeline-navigator-window": TimelineNavigatorWindowElement;
    "audio-ui-timeline-playhead": TimelinePlayheadElement;
    "audio-ui-timeline-range": TimelineRangeElement;
    "audio-ui-timeline-range-handle": TimelineRangeHandleElement;
    "audio-ui-timeline-ruler": TimelineRulerElement;
    "audio-ui-timeline-track": TimelineTrackElement;
    "audio-ui-timeline-track-header": TimelineTrackHeaderElement;
    "audio-ui-timeline-track-resize-handle": TimelineTrackResizeHandleElement;
    "audio-ui-timeline-viewport": TimelineViewportElement;
  }
}
