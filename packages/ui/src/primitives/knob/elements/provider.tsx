import type { KnobDragMode } from "@audio-ui/core/knob";
import * as React from "react";
import { KnobDefaultsContext } from "../context.ts";

/**
 * Sets how every `Knob.Root` below it turns by a drag, unless it has a
 * `dragMode` of its own: wrap an app once to have all its knobs dragged up and
 * down. Renders no element.
 */
export function Provider({ children, dragMode }: Provider.Props) {
  const value = React.useMemo(() => ({ dragMode }), [dragMode]);
  return <KnobDefaultsContext value={value}>{children}</KnobDefaultsContext>;
}

export namespace Provider {
  export interface Props {
    children?: React.ReactNode;
    /** How a pointer drag turns into value, for the knobs that do not set their own. */
    dragMode?: KnobDragMode;
  }
}
