import type * as React from "react";
import { useMeterContext } from "../context.js";

/** Renders one child per channel. */
export function Channels({ children }: Channels.Props) {
  const { meta } = useMeterContext("Channels");
  return (
    <>
      {Array.from({ length: meta.channelCount }, (_, index) =>
        children(index, meta.channelCount)
      )}
    </>
  );
}

export namespace Channels {
  export interface Props {
    children: (index: number, channelCount: number) => React.ReactNode;
  }
}
