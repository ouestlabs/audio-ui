import Fill from "./Fill.svelte";
import Line from "./Line.svelte";
import { parts } from "./parts.ts";

export const Envelope = {
  Fill,
  Graph: parts.Graph,
  Line,
  Point: parts.Point,
  Root: parts.Root,
  Segment: parts.Segment,
};
