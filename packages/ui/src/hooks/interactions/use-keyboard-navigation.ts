import type { Optional, Procedure } from "@audio-ui/utils";
import * as React from "react";
import { useCallbackRef } from "../use-callback-ref";

export type KeyboardNavigationHandler = (
  e: React.KeyboardEvent
) => Optional<boolean>;

export interface UseKeyboardNavigationOptions {
  disabled?: boolean;
  handlers?: {
    onArrowUp?: KeyboardNavigationHandler;
    onArrowDown?: KeyboardNavigationHandler;
    onArrowLeft?: KeyboardNavigationHandler;
    onArrowRight?: KeyboardNavigationHandler;
    onHome?: KeyboardNavigationHandler;
    onEnd?: KeyboardNavigationHandler;
    onPageUp?: KeyboardNavigationHandler;
    onPageDown?: KeyboardNavigationHandler;
    onEnter?: KeyboardNavigationHandler;
    onEscape?: KeyboardNavigationHandler;
  };
  onKeyDown?: Procedure<React.KeyboardEvent>;
}

export interface UseKeyboardNavigationReturn {
  keyboardProps: {
    onKeyDown: Procedure<React.KeyboardEvent>;
  };
}

export function useKeyboardNavigation({
  disabled = false,
  handlers,
  onKeyDown: externalOnKeyDown,
}: UseKeyboardNavigationOptions): UseKeyboardNavigationReturn {
  const handlersRef = React.useRef(handlers);
  React.useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  const externalOnKeyDownRef = useCallbackRef(externalOnKeyDown);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled || !handlersRef.current) {
        return;
      }

      const h = handlersRef.current;
      const keyHandlerMap: Record<
        string,
        KeyboardNavigationHandler | undefined
      > = {
        ArrowUp: h.onArrowUp,
        ArrowDown: h.onArrowDown,
        ArrowLeft: h.onArrowLeft,
        ArrowRight: h.onArrowRight,
        Home: h.onHome,
        End: h.onEnd,
        PageUp: h.onPageUp,
        PageDown: h.onPageDown,
        Enter: h.onEnter,
        Escape: h.onEscape,
      };

      const handler = keyHandlerMap[e.key];
      const handled = handler?.(e) ?? false;

      if (handled) {
        e.preventDefault();
      }
    },
    [disabled]
  );

  const keyboardProps = React.useMemo(
    () => ({
      onKeyDown: (e: React.KeyboardEvent) => {
        externalOnKeyDownRef?.(e);
        handleKeyDown(e);
      },
    }),
    [externalOnKeyDownRef, handleKeyDown]
  );

  return {
    keyboardProps,
  };
}
