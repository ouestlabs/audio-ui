import Clip from "./Clip.svelte";
import ClipFade from "./ClipFade.svelte";
import ClipFadeHandle from "./ClipFadeHandle.svelte";
import ClipHandle from "./ClipHandle.svelte";
import Mark from "./Mark.svelte";
import NavigatorHandle from "./NavigatorHandle.svelte";
import NavigatorWindow from "./NavigatorWindow.svelte";
import { parts } from "./parts.ts";
import Range from "./Range.svelte";
import RangeHandle from "./RangeHandle.svelte";
import Ruler from "./Ruler.svelte";
import TrackResizeHandle from "./TrackResizeHandle.svelte";

export const Timeline = {
  Clip,
  ClipFade,
  ClipFadeHandle,
  ClipHandle,
  ClipHeader: parts.ClipHeader,
  Lane: parts.Lane,
  Mark,
  Navigator: parts.Navigator,
  NavigatorHandle,
  NavigatorWindow,
  Playhead: parts.Playhead,
  Range,
  RangeHandle,
  Root: parts.Root,
  Ruler,
  Track: parts.Track,
  TrackHeader: parts.TrackHeader,
  TrackResizeHandle,
  Viewport: parts.Viewport,
};
