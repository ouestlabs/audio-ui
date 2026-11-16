import Indicator from "./Indicator.svelte";
import Provider from "./Provider.svelte";
import { parts } from "./parts";
import Root from "./Root.svelte";
import Thumb from "./Thumb.svelte";
import Track from "./Track.svelte";
import Value from "./Value.svelte";

export const Knob = {
  Control: parts.Control,
  Indicator,
  Label: parts.Label,
  Mark: parts.Mark,
  Provider,
  Root,
  Thumb,
  Track,
  Value,
};
