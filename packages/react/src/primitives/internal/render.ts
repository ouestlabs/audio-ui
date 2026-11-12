import * as React from "react";

/**
 * How a part's element can be replaced: by an element, cloned with the part's
 * props, or by a function given the props and the part's state.
 */
export type RenderProp<State> =
  | React.ReactElement
  | ((
      props: React.HTMLAttributes<HTMLElement> & { ref?: React.Ref<never> },
      state: State
    ) => React.ReactElement<unknown>);

/** Data attributes for a state field, instead of the default `data-<field>`. */
export type StateAttributesMapping<State> = {
  [Key in keyof State]?: (
    value: State[Key]
  ) => Record<string, string> | null | undefined;
};

type PropsOf<T extends React.ElementType> = React.ComponentPropsWithRef<T>;
type AnyProps = Record<string, unknown>;

/** Whether `key` names an event handler, as React spells them: `on` then a capital. */
function isHandler(key: string): boolean {
  const third = key.charCodeAt(2);
  return key.startsWith("on") && third >= 65 && third <= 90;
}

function joinClassNames(earlier: unknown, later: unknown): string | undefined {
  if (!later) {
    return earlier ? String(earlier) : undefined;
  }
  return earlier ? `${String(later)} ${String(earlier)}` : String(later);
}

function chain(earlier: unknown, later: unknown): unknown {
  if (typeof earlier !== "function") {
    return later;
  }
  if (typeof later !== "function") {
    return earlier;
  }
  // The later set (the consumer's, by convention) runs first.
  return (...args: unknown[]) => {
    const result = later(...args);
    earlier(...args);
    return result;
  };
}

function mergeInto(target: AnyProps, source: AnyProps | undefined): AnyProps {
  if (!source) {
    return target;
  }
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (key === "className") {
      target.className = joinClassNames(target.className, value);
    } else if (key === "style") {
      target.style =
        target.style && value
          ? { ...(target.style as object), ...(value as object) }
          : (value ?? target.style);
    } else if (isHandler(key)) {
      target[key] = chain(target[key], value);
    } else {
      target[key] = value;
    }
  }
  return target;
}

/**
 * Merges sets of props, later sets winning, except that event handlers are
 * chained (the later one first), class names are joined and styles are merged.
 */
export function mergeProps<T extends React.ElementType>(
  ...sets: (PropsOf<T> | AnyProps | undefined)[]
): PropsOf<T> {
  let merged: AnyProps = {};
  for (const set of sets) {
    merged = mergeInto(merged, set as AnyProps | undefined);
  }
  return merged as PropsOf<T>;
}

/** `data-<field>` for each truthy state field, or what `mapping` gives for it. */
function stateAttributes<State>(
  state: State,
  mapping: StateAttributesMapping<State> | undefined
): AnyProps {
  const attributes: AnyProps = {};
  for (const key of Object.keys(state as object) as (keyof State & string)[]) {
    const value = state[key];
    const custom = mapping?.[key];
    if (custom) {
      Object.assign(attributes, custom(value));
    } else if (value === true) {
      attributes[`data-${key.toLowerCase()}`] = "";
    } else if (value) {
      attributes[`data-${key.toLowerCase()}`] = String(value);
    }
  }
  return attributes;
}

function assignRef<T>(
  ref: React.Ref<T> | undefined,
  value: T | null
): (() => void) | undefined {
  if (typeof ref === "function") {
    const cleanup = ref(value);
    return typeof cleanup === "function" ? cleanup : () => ref(null);
  }
  if (ref) {
    (ref as React.RefObject<T | null>).current = value;
    return () => {
      (ref as React.RefObject<T | null>).current = null;
    };
  }
}

/**
 * One ref callback that sets every ref given; stable while they are. A call
 * site passes the same number of refs on every render, so the deps hold.
 */
function useMergedRef<T>(
  refs: (React.Ref<T> | undefined)[]
): React.RefCallback<T> | undefined {
  return React.useMemo(
    () => {
      if (!refs.some(Boolean)) {
        return;
      }
      return (node: T | null) => {
        const cleanups = refs.map((ref) => assignRef(ref, node));
        return () => {
          for (const cleanup of cleanups) {
            cleanup?.();
          }
        };
      };
    },
    // biome-ignore lint/correctness/useExhaustiveDependencies: the refs themselves are the deps, one call site keeps their count
    refs
  );
}

/** A render element's own ref, where React keeps it. */
function elementRef(render: unknown): React.Ref<unknown> | undefined {
  if (!React.isValidElement(render)) {
    return;
  }
  return (render.props as { ref?: React.Ref<unknown> }).ref;
}

const LAZY = Symbol.for("react.lazy");

/** An element sent from a server component arrives wrapped; reading its props needs it unwrapped. */
function unwrapLazy<State>(
  render: RenderProp<State> | undefined
): RenderProp<State> | undefined {
  if ((render as { $$typeof?: symbol } | undefined)?.$$typeof !== LAZY) {
    return render;
  }
  const [unwrapped] = React.Children.toArray(render as React.ReactNode);
  return React.isValidElement(unwrapped) ? unwrapped : render;
}

export interface UseRenderParameters<
  State,
  Rendered extends Element,
  Enabled extends boolean | undefined,
> {
  /** The tag rendered when there is no `render`. */
  defaultTagName?: keyof React.JSX.IntrinsicElements;
  /** `false` renders nothing (the hooks still run, so their order holds). */
  enabled?: Enabled;
  /** The part's props, already merged. */
  props?: object;
  ref?: React.Ref<Rendered> | React.Ref<Rendered>[];
  render?: RenderProp<State>;
  /** Exposed as `data-*` attributes, and passed to a `render` function. */
  state?: State;
  stateAttributesMapping?: StateAttributesMapping<State>;
}

/**
 * Renders a part: its default tag, the element given to `render` cloned with
 * the part's props, or what a `render` function returns for them and the state.
 */
export function useRender<
  State extends object,
  Rendered extends Element = Element,
  Enabled extends boolean | undefined = undefined,
>(
  params: UseRenderParameters<State, Rendered, Enabled>
): Enabled extends false ? null : React.ReactElement {
  const enabled = params.enabled !== false;
  const render = enabled ? unwrapLazy(params.render) : params.render;
  const state = (params.state ?? {}) as State;
  const given = params.props as AnyProps | undefined;
  const extra = (
    Array.isArray(params.ref) ? params.ref : [params.ref]
  ) as React.Ref<unknown>[];
  const ref = useMergedRef<unknown>([
    given?.ref as React.Ref<unknown> | undefined,
    elementRef(render),
    ...extra,
  ]);
  if (!enabled) {
    return null as Enabled extends false ? null : React.ReactElement;
  }
  const props = mergeInto(
    stateAttributes(state, params.stateAttributesMapping),
    given
  );
  props.ref = ref;

  let element: React.ReactElement;
  if (typeof render === "function") {
    element = render(props as Parameters<typeof render>[0], state);
  } else if (render) {
    const cloned = mergeProps(props, render.props as AnyProps);
    cloned.ref = ref;
    element = React.cloneElement(render, cloned);
  } else {
    const tag = params.defaultTagName ?? "div";
    element = React.createElement(
      tag,
      tag === "button" ? { type: "button", ...props } : props
    );
  }
  return element as Enabled extends false ? null : React.ReactElement;
}
