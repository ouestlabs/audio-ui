import type { Procedure } from "@audio-ui/utils";
import * as React from "react";
import { useCallbackRef } from "../use-callback-ref";

export interface UseFocusOptions<T extends HTMLElement = HTMLElement> {
  disabled?: boolean;
  onFocus?: Procedure<React.FocusEvent<T>>;
  onBlur?: Procedure<React.FocusEvent<T>>;
  tabIndex?: number;
}

export interface UseFocusReturn<T extends HTMLElement = HTMLElement> {
  focusProps: {
    tabIndex: number;
    onFocus: Procedure<React.FocusEvent<T>>;
    onBlur: Procedure<React.FocusEvent<T>>;
  };
}

export function useFocus<T extends HTMLElement = HTMLElement>({
  disabled = false,
  onFocus: onFocusInternal,
  onBlur: onBlurInternal,
  tabIndex: providedTabIndex,
}: UseFocusOptions<T> = {}): UseFocusReturn<T> {
  const onFocusRef = useCallbackRef(onFocusInternal);
  const onBlurRef = useCallbackRef(onBlurInternal);

  const handleFocus = React.useCallback(
    (e: React.FocusEvent<T>) => {
      if (!disabled) {
        onFocusRef?.(e);
      }
    },
    [disabled, onFocusRef]
  );

  const handleBlur = React.useCallback(
    (e: React.FocusEvent<T>) => {
      onBlurRef?.(e);
    },
    [onBlurRef]
  );

  const tabIndex: number = providedTabIndex ?? (disabled ? -1 : 0);

  const focusProps = React.useMemo(
    () => ({
      tabIndex,
      onFocus: handleFocus,
      onBlur: handleBlur,
    }),
    [tabIndex, handleFocus, handleBlur]
  );

  return {
    focusProps,
  };
}
