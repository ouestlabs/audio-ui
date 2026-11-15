import Band from "./Band.svelte";
import Curve from "./Curve.svelte";
import Grid from "./Grid.svelte";
import Handle from "./Handle.svelte";
import Line from "./Line.svelte";
import { parts } from "./parts.ts";
import Trace from "./Trace.svelte";

export const Plot = {
  Band,
  Curve,
  Cursor: parts.Cursor,
  CursorReadout: parts.CursorReadout,
  Dot: parts.Dot,
  Grid,
  Handle,
  Line,
  Mark: parts.Mark,
  Root: parts.Root,
  Trace,
};
