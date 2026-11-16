import Cell from "./Cell.svelte";
import { parts } from "./parts";
import Velocity from "./Velocity.svelte";

export const Sequencer = { Cell, Root: parts.Root, Row: parts.Row, Velocity };
