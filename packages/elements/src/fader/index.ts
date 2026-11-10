/**
 * Fader Web Components. Importing this entry point registers its elements:
 *
 * ```html
 * <audio-ui-fader min="-60" max="6" value="0">
 *   <audio-ui-fader-label>Volume</audio-ui-fader-label>
 *   <audio-ui-fader-control>
 *     <audio-ui-fader-track>
 *       <audio-ui-fader-indicator></audio-ui-fader-indicator>
 *       <audio-ui-fader-thumb></audio-ui-fader-thumb>
 *     </audio-ui-fader-track>
 *   </audio-ui-fader-control>
 *   <audio-ui-fader-value></audio-ui-fader-value>
 * </audio-ui-fader>
 * ```
 */
import { define, structure } from "../internal/element.ts";
import {
  FADER_TAGS,
  FaderControlElement,
  FaderElement,
  FaderIndicatorElement,
  FaderLabelElement,
  FaderThumbElement,
  FaderTrackElement,
  FaderValueElement,
} from "./elements.ts";

export {
  FADER_TAGS,
  type FaderChangeEvent,
  FaderControlElement,
  FaderElement,
  type FaderElementEventMap,
  type FaderEventDetail,
  FaderIndicatorElement,
  type FaderInputEvent,
  FaderLabelElement,
  FaderThumbElement,
  FaderTrackElement,
  FaderValueElement,
} from "./elements.ts";

structure(
  `:where(${FADER_TAGS.root}, ${FADER_TAGS.control}, ${FADER_TAGS.track}, ${FADER_TAGS.indicator}, ${FADER_TAGS.thumb}, ${FADER_TAGS.label}) { display: block }
:where(${FADER_TAGS.control}) { position: relative; touch-action: none }
:where(${FADER_TAGS.track}) { position: relative }`
);

// The fader first, so a part that connects finds it upgraded.
define({
  [FADER_TAGS.root]: FaderElement,
  [FADER_TAGS.control]: FaderControlElement,
  [FADER_TAGS.track]: FaderTrackElement,
  [FADER_TAGS.indicator]: FaderIndicatorElement,
  [FADER_TAGS.thumb]: FaderThumbElement,
  [FADER_TAGS.value]: FaderValueElement,
  [FADER_TAGS.label]: FaderLabelElement,
});

declare global {
  interface HTMLElementTagNameMap {
    "audio-ui-fader": FaderElement;
    "audio-ui-fader-control": FaderControlElement;
    "audio-ui-fader-indicator": FaderIndicatorElement;
    "audio-ui-fader-label": FaderLabelElement;
    "audio-ui-fader-thumb": FaderThumbElement;
    "audio-ui-fader-track": FaderTrackElement;
    "audio-ui-fader-value": FaderValueElement;
  }
}
