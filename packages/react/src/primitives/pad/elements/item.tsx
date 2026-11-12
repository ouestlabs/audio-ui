import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part.ts";
import { mergeProps, useRender } from "../../internal/render.ts";
import { usePadContext } from "../context.ts";

/**
 * One pad. It sounds while held: by pointer, or with Enter or Space while
 * focused. Its accessible name comes from its content, or `aria-label`. How
 * hard it was last struck is the `--pad-velocity` CSS variable, from 0 to 1.
 * Renders a `<button>` element.
 */
export function Item(componentProps: Item.Props) {
  const {
    chokeGroup,
    className,
    disabled: disabledProp = false,
    ref,
    render,
    style,
    value,
    ...elementProps
  } = componentProps;
  const {
    controller,
    focusPad,
    meta,
    registerItem,
    state: rootState,
  } = usePadContext("Item");
  const disabled = rootState.disabled || disabledProp;
  const pad = { chokeGroup, value };

  const itemRef = React.useCallback(
    (node: HTMLElement | null) => registerItem(value, node, disabled),
    [disabled, registerItem, value]
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || event.button !== 0) {
      return;
    }
    event.preventDefault();
    focusPad(value, false);
    controller.press(pad, event.nativeEvent, event.currentTarget);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) {
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      controller.keyOn(pad, event.nativeEvent);
      return;
    }
    const next = controller.navigate(value, event.nativeEvent);
    if (next !== null) {
      event.preventDefault();
      focusPad(next);
    }
  };

  const handleKeyUp = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      controller.keyOff(value, event.nativeEvent);
    }
  };

  const state = React.useMemo<Item.State>(
    () => ({ active: meta.active.has(value), disabled }),
    [disabled, meta.active, value]
  );

  const velocity = meta.velocities.get(value);
  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        disabled,
        onBlur: (event) => controller.keyOff(value, event.nativeEvent),
        onFocus: () => controller.focusPad(value),
        onKeyDown: handleKeyDown,
        onKeyUp: handleKeyUp,
        onPointerDown: handlePointerDown,
        style: {
          touchAction: "none",
          ...(velocity === undefined
            ? undefined
            : { "--pad-velocity": velocity }),
        } as React.CSSProperties,
        tabIndex: value === meta.tabStop ? 0 : -1,
        type: "button",
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref: ref ? [ref, itemRef] : itemRef,
    render,
    state,
  });
}

export namespace Item {
  export type State = {
    /** Whether the pad is sounding: held here, or listed in `activePads`. */
    active: boolean;
    disabled: boolean;
  };
  export interface Props extends PartProps<"button", State> {
    /** Pads sharing a choke group stop each other: striking one stops the last one struck, held or still ringing. */
    chokeGroup?: string;
    disabled?: boolean;
    /** What identifies this pad in `onPadOn`, `onPadOff` and `activePads`. */
    value: string;
  }
}
