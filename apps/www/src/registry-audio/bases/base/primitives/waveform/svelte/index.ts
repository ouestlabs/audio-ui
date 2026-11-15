import Bars from "./Bars.svelte";
import Control from "./Control.svelte";
import { parts } from "./parts.ts";
import RegionHandle from "./RegionHandle.svelte";

export const Waveform = {
  Bar: parts.Bar,
  Bars,
  Canvas: parts.Canvas,
  Control,
  Hover: parts.Hover,
  Marker: parts.Marker,
  Playhead: parts.Playhead,
  Region: parts.Region,
  RegionHandle,
  Root: parts.Root,
  Thumb: parts.Thumb,
};
