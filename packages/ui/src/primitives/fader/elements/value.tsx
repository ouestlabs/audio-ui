import { Slider } from "@base-ui/react/slider";

/** The formatted value (`format`/`locale` on Root). Renders an `<output>` element. */
export const { Value } = Slider;

export namespace Value {
  export type Props = Slider.Value.Props;
  export type State = Slider.Value.State;
}
