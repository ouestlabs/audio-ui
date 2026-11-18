import Note from "./Note.svelte";
import NoteHandle from "./NoteHandle.svelte";
import Notes from "./Notes.svelte";
import { parts } from "./parts";
import Rows from "./Rows.svelte";
import StretchHandle from "./StretchHandle.svelte";
import Velocity from "./Velocity.svelte";

export const PianoRoll = {
  Grid: parts.Grid,
  Keys: parts.Keys,
  Marquee: parts.Marquee,
  Note,
  NoteHandle,
  Notes,
  Root: parts.Root,
  Row: parts.Row,
  Rows,
  SelectionSpan: parts.SelectionSpan,
  StretchHandle,
  Velocity,
  VelocityLane: parts.VelocityLane,
};
