import { Slider } from "@base-ui/react/slider";

/** The full range of travel. Renders a `<div>` element. */
export const { Track } = Slider;

export namespace Track {
  export type Props = Slider.Track.Props;
  export type State = Slider.Track.State;
}
