import { Meter as BaseMeter } from "@base-ui/react/meter";
import type * as React from "react";
import {
  useChannelIndex,
  useChannelPart,
  useMergedRef,
} from "../internal/channel";

/**
 * The channel's formatted level (`format`/`locale` on Root). With a live
 * `source` only the default text is kept current, not a `children` function.
 * Renders a `<span>` element.
 */
export function Value({ ref, ...props }: Value.Props) {
  const index = useChannelIndex("Value");
  const { registerRef } = useChannelPart("Value", index, "value");
  const mergedRef = useMergedRef(ref, registerRef);
  return <BaseMeter.Value {...props} ref={mergedRef} />;
}

export namespace Value {
  export type State = BaseMeter.Value.State;
  export type Props = BaseMeter.Value.Props & {
    ref?: React.Ref<HTMLSpanElement>;
  };
}
