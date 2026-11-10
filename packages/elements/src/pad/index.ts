/**
 * The drum pads as custom elements. Importing this module registers them:
 *
 * ```html
 * <audio-ui-pad aria-label="Drum pads" columns="4">
 *   <audio-ui-pad-item value="kick">Kick</audio-ui-pad-item>
 *   <audio-ui-pad-item value="snare">Snare</audio-ui-pad-item>
 *   <audio-ui-pad-item value="closed" choke-group="hat">Closed hat</audio-ui-pad-item>
 *   <audio-ui-pad-item value="open" choke-group="hat">Open hat</audio-ui-pad-item>
 * </audio-ui-pad>
 * ```
 */
import { define } from "../internal/element.ts";
import { PAD_TAGS, PadElement, PadItemElement } from "./elements.ts";

export {
  PAD_TAGS,
  PadElement,
  type PadElementEventMap,
  PadItemElement,
  type PadOffDetail,
  type PadOffEvent,
  type PadOnDetail,
  type PadOnEvent,
} from "./elements.ts";

// The grid first, so a pad that connects finds it upgraded.
define({ [PAD_TAGS.root]: PadElement, [PAD_TAGS.item]: PadItemElement });

declare global {
  interface HTMLElementTagNameMap {
    "audio-ui-pad": PadElement;
    "audio-ui-pad-item": PadItemElement;
  }
}
