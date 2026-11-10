/**
 * Knob Web Components. Importing this entry point registers its elements:
 *
 * ```html
 * <audio-ui-knob min="0" max="100" value="40">
 *   <audio-ui-knob-label>Cutoff</audio-ui-knob-label>
 *   <audio-ui-knob-control>
 *     <audio-ui-knob-track></audio-ui-knob-track>
 *     <audio-ui-knob-indicator></audio-ui-knob-indicator>
 *     <audio-ui-knob-thumb></audio-ui-knob-thumb>
 *   </audio-ui-knob-control>
 *   <audio-ui-knob-value></audio-ui-knob-value>
 * </audio-ui-knob>
 * ```
 */
import { define, structure } from "../internal/element.ts";
import {
  KNOB_TAGS,
  KnobControlElement,
  KnobElement,
  KnobIndicatorElement,
  KnobLabelElement,
  KnobThumbElement,
  KnobTrackElement,
  KnobValueElement,
} from "./elements.ts";

export {
  KNOB_TAGS,
  type KnobChangeEvent,
  KnobControlElement,
  KnobElement,
  type KnobElementEventMap,
  type KnobEventDetail,
  KnobIndicatorElement,
  type KnobInputEvent,
  KnobLabelElement,
  KnobThumbElement,
  KnobTrackElement,
  KnobValueElement,
} from "./elements.ts";

structure(
  `:where(${KNOB_TAGS.root}, ${KNOB_TAGS.control}, ${KNOB_TAGS.track}, ${KNOB_TAGS.indicator}, ${KNOB_TAGS.thumb}, ${KNOB_TAGS.label}) { display: block }
:where(${KNOB_TAGS.control}) { position: relative; touch-action: none }`
);

// The knob first, so a part that connects finds it upgraded.
define({
  [KNOB_TAGS.root]: KnobElement,
  [KNOB_TAGS.control]: KnobControlElement,
  [KNOB_TAGS.track]: KnobTrackElement,
  [KNOB_TAGS.indicator]: KnobIndicatorElement,
  [KNOB_TAGS.thumb]: KnobThumbElement,
  [KNOB_TAGS.value]: KnobValueElement,
  [KNOB_TAGS.label]: KnobLabelElement,
});

declare global {
  interface HTMLElementTagNameMap {
    "audio-ui-knob": KnobElement;
    "audio-ui-knob-control": KnobControlElement;
    "audio-ui-knob-indicator": KnobIndicatorElement;
    "audio-ui-knob-label": KnobLabelElement;
    "audio-ui-knob-thumb": KnobThumbElement;
    "audio-ui-knob-track": KnobTrackElement;
    "audio-ui-knob-value": KnobValueElement;
  }
}
