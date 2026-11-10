/**
 * Step sequencer Web Components. Importing this entry point registers its
 * elements. Rows and steps are generated from nested `<template>`s:
 *
 * ```html
 * <audio-ui-sequencer aria-label="Pattern" default-value="x...x... ..x...x.">
 *   <audio-ui-sequencer-rows labels="Kick, Snare">
 *     <template>
 *       <audio-ui-sequencer-steps>
 *         <template><audio-ui-sequencer-cell></audio-ui-sequencer-cell></template>
 *       </audio-ui-sequencer-steps>
 *     </template>
 *   </audio-ui-sequencer-rows>
 * </audio-ui-sequencer>
 * ```
 */
import { define, structure } from "../internal/element.ts";
import {
  SEQUENCER_TAGS,
  SequencerCellElement,
  SequencerElement,
  SequencerRowElement,
  SequencerRowsElement,
  SequencerStepElement,
  SequencerStepsElement,
  SequencerVelocityElement,
} from "./elements.ts";

export {
  SEQUENCER_TAGS,
  SequencerCellElement,
  type SequencerChangeEvent,
  SequencerElement,
  type SequencerElementEventMap,
  type SequencerEventDetail,
  type SequencerInputEvent,
  SequencerRowElement,
  SequencerRowsElement,
  type SequencerSource,
  SequencerStepElement,
  SequencerStepsElement,
  type SequencerVelocityChangeEvent,
  type SequencerVelocityDetail,
  SequencerVelocityElement,
  type SequencerVelocityInputEvent,
} from "./elements.ts";

structure(
  `:where(${SEQUENCER_TAGS.root}, ${SEQUENCER_TAGS.row}, ${SEQUENCER_TAGS.cell}, ${SEQUENCER_TAGS.velocity}) { display: block }
:where(${SEQUENCER_TAGS.rows}, ${SEQUENCER_TAGS.steps}, ${SEQUENCER_TAGS.step}) { display: contents }
:where(${SEQUENCER_TAGS.root}) { touch-action: none }`
);

// The sequencer first, so a part that connects finds it upgraded.
define({
  [SEQUENCER_TAGS.root]: SequencerElement,
  [SEQUENCER_TAGS.rows]: SequencerRowsElement,
  [SEQUENCER_TAGS.row]: SequencerRowElement,
  [SEQUENCER_TAGS.steps]: SequencerStepsElement,
  [SEQUENCER_TAGS.step]: SequencerStepElement,
  [SEQUENCER_TAGS.cell]: SequencerCellElement,
  [SEQUENCER_TAGS.velocity]: SequencerVelocityElement,
});

declare global {
  interface HTMLElementTagNameMap {
    "audio-ui-sequencer": SequencerElement;
    "audio-ui-sequencer-cell": SequencerCellElement;
    "audio-ui-sequencer-row": SequencerRowElement;
    "audio-ui-sequencer-rows": SequencerRowsElement;
    "audio-ui-sequencer-step": SequencerStepElement;
    "audio-ui-sequencer-steps": SequencerStepsElement;
    "audio-ui-sequencer-velocity": SequencerVelocityElement;
  }
}
