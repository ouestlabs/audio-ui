/**
 * Level meter Web Components. Importing this entry point registers its
 * elements. `<audio-ui-meter-channels>` generates a channel per level from
 * its `<template>`:
 *
 * ```html
 * <audio-ui-meter aria-label="Output" value="-12 -6" unit="dB">
 *   <audio-ui-meter-channels label="Output {n}">
 *     <template>
 *       <audio-ui-meter-track></audio-ui-meter-track>
 *       <audio-ui-meter-indicator></audio-ui-meter-indicator>
 *       <audio-ui-meter-peak></audio-ui-meter-peak>
 *     </template>
 *   </audio-ui-meter-channels>
 * </audio-ui-meter>
 * ```
 *
 * For a live signal, set its `source` property to `{ getSnapshot, subscribe }`.
 */
import { define, structure } from "../internal/element.ts";
import {
  METER_TAGS,
  MeterChannelElement,
  MeterChannelsElement,
  MeterElement,
  MeterIndicatorElement,
  MeterLabelElement,
  MeterMarkElement,
  MeterPeakElement,
  MeterTrackElement,
  MeterValueElement,
} from "./elements.ts";

export {
  METER_TAGS,
  MeterChannelElement,
  MeterChannelsElement,
  MeterElement,
  MeterIndicatorElement,
  MeterLabelElement,
  MeterMarkElement,
  MeterPeakElement,
  type MeterSnapshot,
  type MeterSource,
  MeterTrackElement,
  MeterValueElement,
} from "./elements.ts";

structure(
  `:where(${METER_TAGS.root}, ${METER_TAGS.channel}, ${METER_TAGS.track}, ${METER_TAGS.indicator}, ${METER_TAGS.peak}, ${METER_TAGS.mark}) { display: block }
:where(${METER_TAGS.channels}) { display: contents }
:where(${METER_TAGS.channel}) { position: relative }`
);

// The meter first, so a part that connects finds it upgraded.
define({
  [METER_TAGS.root]: MeterElement,
  [METER_TAGS.channels]: MeterChannelsElement,
  [METER_TAGS.channel]: MeterChannelElement,
  [METER_TAGS.track]: MeterTrackElement,
  [METER_TAGS.indicator]: MeterIndicatorElement,
  [METER_TAGS.peak]: MeterPeakElement,
  [METER_TAGS.value]: MeterValueElement,
  [METER_TAGS.label]: MeterLabelElement,
  [METER_TAGS.mark]: MeterMarkElement,
});

declare global {
  interface HTMLElementTagNameMap {
    "audio-ui-meter": MeterElement;
    "audio-ui-meter-channel": MeterChannelElement;
    "audio-ui-meter-channels": MeterChannelsElement;
    "audio-ui-meter-indicator": MeterIndicatorElement;
    "audio-ui-meter-label": MeterLabelElement;
    "audio-ui-meter-mark": MeterMarkElement;
    "audio-ui-meter-peak": MeterPeakElement;
    "audio-ui-meter-track": MeterTrackElement;
    "audio-ui-meter-value": MeterValueElement;
  }
}
