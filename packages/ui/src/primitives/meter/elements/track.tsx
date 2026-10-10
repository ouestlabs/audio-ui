import { Meter as BaseMeter } from "@base-ui/react/meter";

/** The full range of a channel, behind the indicator. Renders a `<div>` element. */
export const { Track } = BaseMeter;

export namespace Track {
  export type Props = BaseMeter.Track.Props;
  export type State = BaseMeter.Track.State;
}
