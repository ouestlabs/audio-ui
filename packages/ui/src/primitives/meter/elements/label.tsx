import { Meter as BaseMeter } from "@base-ui/react/meter";

/** Accessible label of the channel it is in. Renders a `<span>` element. */
export const { Label } = BaseMeter;

export namespace Label {
  export type Props = BaseMeter.Label.Props;
  export type State = BaseMeter.Label.State;
}
