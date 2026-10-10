import { Slider } from "@base-ui/react/slider";

/**
 * The draggable thumb, with a nested `<input type="range">` that carries the
 * accessible name (`aria-label`/`aria-labelledby`) and form value.
 * Renders a `<div>` element.
 */
export const { Thumb } = Slider;

export namespace Thumb {
  export type Props = Slider.Thumb.Props;
  export type State = Slider.Thumb.State;
}
