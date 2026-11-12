import type * as React from "react";
import type { RenderProp } from "./render.ts";

type StateClassName<State> =
  | string
  | ((state: State) => string | undefined)
  | undefined;
type StateStyle<State> =
  | React.CSSProperties
  | ((state: State) => React.CSSProperties | undefined)
  | undefined;

/**
 * Props of a primitive part that renders `Tag`: the element's own props, a
 * `render` prop to swap or compose the element, and `className`/`style` that
 * may be functions of the part's state.
 */
export type PartProps<
  Tag extends keyof React.JSX.IntrinsicElements,
  State extends object,
> = Omit<React.ComponentPropsWithRef<Tag>, "className" | "style"> & {
  className?: StateClassName<State>;
  render?: RenderProp<State>;
  style?: StateStyle<State>;
};

/** Resolves state-aware `className`/`style` into plain props for `mergeProps`. */
export function resolveStyling<State>(
  className: StateClassName<State>,
  style: StateStyle<State>,
  state: State
): { className?: string; style?: React.CSSProperties } {
  return {
    className: typeof className === "function" ? className(state) : className,
    style: typeof style === "function" ? style(state) : style,
  };
}
