import Clip from "./Clip.svelte";
import ClipFade from "./ClipFade.svelte";
import ClipFadeHandle from "./ClipFadeHandle.svelte";
import ClipHandle from "./ClipHandle.svelte";
import Mark from "./Mark.svelte";
import { parts } from "./parts.ts";
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
  Playhead: parts.Playhead,
  Root: parts.Root,
  Ruler,
  Track: parts.Track,
  TrackHeader: parts.TrackHeader,
  TrackResizeHandle,
  Viewport: parts.Viewport,
};
