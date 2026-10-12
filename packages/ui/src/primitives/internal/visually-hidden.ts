import type * as React from "react";

/** Keeps an element in the accessibility tree and focusable, but out of sight. */
export const VISUALLY_HIDDEN: React.CSSProperties = {
  border: 0,
  clipPath: "inset(50%)",
  height: 1,
  margin: -1,
  overflow: "hidden",
  padding: 0,
  position: "absolute",
  whiteSpace: "nowrap",
  width: 1,
};
