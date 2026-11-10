/**
 * The XY pad as custom elements. Importing this module registers them:
 *
 * ```html
 * <audio-ui-xypad min-x="20" max-x="20000" value="1000 50">
 *   <audio-ui-xypad-label>Filter</audio-ui-xypad-label>
 *   <audio-ui-xypad-control>
 *     <audio-ui-xypad-thumb label-x="Cutoff" label-y="Resonance"></audio-ui-xypad-thumb>
 *   </audio-ui-xypad-control>
 *   <audio-ui-xypad-value></audio-ui-xypad-value>
 * </audio-ui-xypad>
 * ```
 */
import { define, structure } from "../internal/element.ts";
import {
  XYPAD_TAGS,
  XYPadControlElement,
  XYPadElement,
  XYPadLabelElement,
  XYPadThumbElement,
  XYPadValueElement,
} from "./elements.ts";

export {
  XYPAD_TAGS,
  type XYPadChangeEvent,
  XYPadControlElement,
  XYPadElement,
  type XYPadElementEventMap,
  type XYPadEventDetail,
  type XYPadInputEvent,
  XYPadLabelElement,
  XYPadThumbElement,
  XYPadValueElement,
} from "./elements.ts";

structure(
  `:where(${XYPAD_TAGS.root}, ${XYPAD_TAGS.control}, ${XYPAD_TAGS.thumb}, ${XYPAD_TAGS.label}) { display: block }
:where(${XYPAD_TAGS.control}) { position: relative; touch-action: none }`
);

// The pad first, so a part that connects finds it upgraded.
define({
  [XYPAD_TAGS.root]: XYPadElement,
  [XYPAD_TAGS.control]: XYPadControlElement,
  [XYPAD_TAGS.thumb]: XYPadThumbElement,
  [XYPAD_TAGS.value]: XYPadValueElement,
  [XYPAD_TAGS.label]: XYPadLabelElement,
});

declare global {
  interface HTMLElementTagNameMap {
    "audio-ui-xypad": XYPadElement;
    "audio-ui-xypad-control": XYPadControlElement;
    "audio-ui-xypad-label": XYPadLabelElement;
    "audio-ui-xypad-thumb": XYPadThumbElement;
    "audio-ui-xypad-value": XYPadValueElement;
  }
}
