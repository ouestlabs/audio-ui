import { createParts } from "@ui-sdk/react/primitive";
import type { ComponentProps } from "react";
import { piano } from "@/primitives/piano";

/** Which element each part is. */
const parts = createParts(piano, { key: "button", label: "span", root: "div" });

/** The name of the key it sits in, such as "C4", unless it has content of its own. */
function Label({ children, ...props }: ComponentProps<typeof parts.Label>) {
  return (
    <parts.Label {...props}>{children ?? (({ name }) => name)}</parts.Label>
  );
}

/**
 * The keys are written by the app, one for each pitch: the Root's children
 * can be a function of its state, whose `pitches` lists them, lowest first.
 */
export const Piano = { Key: parts.Key, Label, Root: parts.Root };
