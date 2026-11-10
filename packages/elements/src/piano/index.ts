/**
 * Piano keyboard Web Components. Importing this entry point registers its
 * elements. `<audio-ui-piano-keys>` generates a key per pitch from its
 * `<template>`:
 *
 * ```html
 * <audio-ui-piano min-pitch="48" max-pitch="72" aria-label="Piano">
 *   <audio-ui-piano-keys>
 *     <template><audio-ui-piano-key-label></audio-ui-piano-key-label></template>
 *   </audio-ui-piano-keys>
 * </audio-ui-piano>
 * ```
 */
import { define, structure } from "../internal/element.ts";
import {
  PIANO_TAGS,
  PianoElement,
  PianoKeyElement,
  PianoKeyLabelElement,
  PianoKeysElement,
} from "./elements.ts";

export {
  PIANO_TAGS,
  PianoElement,
  type PianoElementEventMap,
  PianoKeyElement,
  PianoKeyLabelElement,
  PianoKeysElement,
  type PianoNoteOffDetail,
  type PianoNoteOffEvent,
  type PianoNoteOnDetail,
  type PianoNoteOnEvent,
} from "./elements.ts";

structure(
  `:where(${PIANO_TAGS.root}) { display: block; position: relative; touch-action: none }
:where(${PIANO_TAGS.keys}) { display: contents }
:where(${PIANO_TAGS.key}) { display: block }`
);

// The piano first, so a key that connects finds it upgraded.
define({
  [PIANO_TAGS.root]: PianoElement,
  [PIANO_TAGS.keys]: PianoKeysElement,
  [PIANO_TAGS.key]: PianoKeyElement,
  [PIANO_TAGS.keyLabel]: PianoKeyLabelElement,
});

declare global {
  interface HTMLElementTagNameMap {
    "audio-ui-piano": PianoElement;
    "audio-ui-piano-key": PianoKeyElement;
    "audio-ui-piano-key-label": PianoKeyLabelElement;
    "audio-ui-piano-keys": PianoKeysElement;
  }
}
