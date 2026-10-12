import type * as React from "react";
import { KeyContext, usePianoContext } from "../context.js";

/**
 * Renders `children` once per key, lowest first: the place to put a
 * `Piano.Key` for each pitch. Renders no element of its own.
 */
export function Keys({ children }: Keys.Props) {
  const { meta } = usePianoContext("Keys");
  return (
    <>
      {meta.pitches.map((pitch) => (
        <KeyContext key={pitch} value={pitch}>
          {children(pitch)}
        </KeyContext>
      ))}
    </>
  );
}

export namespace Keys {
  export interface Props {
    children: (pitch: number) => React.ReactNode;
  }
}
