import { Slider } from "@base-ui/react/slider";

/** Accessible label, associated with the thumb. Renders a `<div>` element. */
export const { Label } = Slider;

export namespace Label {
  export type Props = Slider.Label.Props;
  export type State = Slider.Label.State;
}
