import {
  assertType,
  isDefined,
  type Nullable,
  type Point,
} from "@audio-ui/utils";
import * as React from "react";
import { useCallbackRef } from "../use-callback-ref";

export interface UseWheelOptions<T extends HTMLElement = HTMLElement> {
  disabled?: boolean;
  elementRef?: React.RefObject<Nullable<T>>;
  onWheel?: ((e: WheelEvent, delta: Point) => void) | ((delta: Point) => void);
  preventDefault?: boolean;
}

export interface UseWheelReturn<T extends HTMLElement = HTMLElement> {
  wheelRef: (node: Nullable<T>) => void;
}

export function useWheel<T extends HTMLElement = HTMLElement>({
  disabled = false,
  elementRef,
  onWheel: onWheelInternal,
  preventDefault = true,
}: UseWheelOptions<T> = {}): UseWheelReturn<T> {
  const onWheelRef = useCallbackRef(onWheelInternal);
  const onWheelTakesEvent = React.useMemo(() => {
    if (!isDefined(onWheelInternal)) {
      return false;
    }
    return onWheelInternal.length === 2;
  }, [onWheelInternal]);
  const elementRefInternal = React.useRef<Nullable<T>>(null);

  React.useEffect(() => {
    const element = elementRefInternal.current;
    if (!isDefined(element) || disabled) {
      return;
    }

    const abortController = new AbortController();
    const { signal } = abortController;

    const handleWheel = (e: WheelEvent) => {
      if (signal.aborted) {
        return;
      }

      if (preventDefault) {
        e.preventDefault();
      }

      const deltaValue: Point = {
        x: e.deltaX,
        y: e.deltaY,
      };

      if (!isDefined(onWheelRef)) {
        return;
      }

      if (onWheelTakesEvent) {
        assertType<(evt: WheelEvent, d: Point) => void>(onWheelRef);
        onWheelRef(e, deltaValue);
      } else {
        assertType<(d: Point) => void>(onWheelRef);
        onWheelRef(deltaValue);
      }
    };

    element.addEventListener("wheel", handleWheel, {
      passive: !preventDefault,
      signal,
    });

    return () => {
      abortController.abort();
    };
  }, [disabled, onWheelRef, preventDefault, onWheelTakesEvent]);

  const wheelRef = React.useCallback(
    (node: Nullable<T>) => {
      elementRefInternal.current = node;
      if (elementRef && "current" in elementRef) {
        elementRef.current = node;
      }
    },
    [elementRef]
  );

  return {
    wheelRef,
  };
}
