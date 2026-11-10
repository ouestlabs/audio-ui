/**
 * The breakpoint envelope as custom elements. Importing this module
 * registers them. The points element makes a handle per point, and the
 * segments element a handle per segment, each from its template if it has
 * one:
 *
 * ```html
 * <audio-ui-envelope aria-label="Amp envelope" default-value="0 0, 0.2 1, 0.6 0.5, 1 0">
 *   <audio-ui-envelope-graph>
 *     <audio-ui-envelope-fill></audio-ui-envelope-fill>
 *     <audio-ui-envelope-line></audio-ui-envelope-line>
 *   </audio-ui-envelope-graph>
 *   <audio-ui-envelope-segments></audio-ui-envelope-segments>
 *   <audio-ui-envelope-points></audio-ui-envelope-points>
 * </audio-ui-envelope>
 * ```
 */
import { define, structure } from "../internal/element.ts";
import {
  ENVELOPE_TAGS,
  EnvelopeElement,
  EnvelopeFillElement,
  EnvelopeGraphElement,
  EnvelopeLineElement,
  EnvelopePointElement,
  EnvelopePointsElement,
  EnvelopeSegmentElement,
  EnvelopeSegmentsElement,
} from "./elements.ts";

export {
  ENVELOPE_TAGS,
  type EnvelopeChangeEvent,
  EnvelopeElement,
  type EnvelopeElementEventMap,
  type EnvelopeEventDetail,
  EnvelopeFillElement,
  EnvelopeGraphElement,
  type EnvelopeInputEvent,
  EnvelopeLineElement,
  EnvelopePointElement,
  EnvelopePointsElement,
  EnvelopeSegmentElement,
  EnvelopeSegmentsElement,
} from "./elements.ts";

structure(
  `:where(${ENVELOPE_TAGS.root}) { display: block; position: relative }
:where(${ENVELOPE_TAGS.graph}, ${ENVELOPE_TAGS.line}, ${ENVELOPE_TAGS.fill}) { display: block; position: absolute; inset: 0 }
:where(${ENVELOPE_TAGS.points}, ${ENVELOPE_TAGS.segments}) { display: contents }
:where(${ENVELOPE_TAGS.point}, ${ENVELOPE_TAGS.segment}) { display: block; position: absolute; touch-action: none; transform: translate(-50%, 50%) }`
);

// The envelope first, so a part that connects finds it upgraded.
define({
  [ENVELOPE_TAGS.root]: EnvelopeElement,
  [ENVELOPE_TAGS.graph]: EnvelopeGraphElement,
  [ENVELOPE_TAGS.line]: EnvelopeLineElement,
  [ENVELOPE_TAGS.fill]: EnvelopeFillElement,
  [ENVELOPE_TAGS.points]: EnvelopePointsElement,
  [ENVELOPE_TAGS.point]: EnvelopePointElement,
  [ENVELOPE_TAGS.segments]: EnvelopeSegmentsElement,
  [ENVELOPE_TAGS.segment]: EnvelopeSegmentElement,
});

declare global {
  interface HTMLElementTagNameMap {
    "audio-ui-envelope": EnvelopeElement;
    "audio-ui-envelope-fill": EnvelopeFillElement;
    "audio-ui-envelope-graph": EnvelopeGraphElement;
    "audio-ui-envelope-line": EnvelopeLineElement;
    "audio-ui-envelope-point": EnvelopePointElement;
    "audio-ui-envelope-points": EnvelopePointsElement;
    "audio-ui-envelope-segment": EnvelopeSegmentElement;
    "audio-ui-envelope-segments": EnvelopeSegmentsElement;
  }
}
