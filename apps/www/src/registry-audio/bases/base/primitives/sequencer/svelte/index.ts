import Cell from "./Cell.svelte";
import { parts } from "./parts.ts";
import Velocity from "./Velocity.svelte";

export const Sequencer = { Cell, Root: parts.Root, Row: parts.Row, Velocity };
