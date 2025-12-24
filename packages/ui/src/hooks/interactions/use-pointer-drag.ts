import {
  assertType,
  type Nullable,
  type Point,
  type Procedure,
} from "@audio-ui/utils";
import * as React from "react";
import { useCallbackRef } from "../use-callback-ref";

const MAX_POINTER_ID = 10;

function releaseAllPointerCaptures(element: HTMLElement) {
  for (let pointerId = 0; pointerId < MAX_POINTER_ID; pointerId++) {
    if (element.hasPointerCapture(pointerId)) {
      element.releasePointerCapture(pointerId);
    }
  }
}

export interface UsePointerDragOptions<T extends HTMLElement = HTMLElement> {
  disabled?: boolean;
  onDragStart?: Procedure<React.PointerEvent<T>>;
  onDrag?:
    | ((e: React.PointerEvent<T>, delta: Point) => void)
    | ((delta: Point) => void);
  onDragEnd?: Procedure<React.PointerEvent<T>>;
  onDragCancel?: Procedure<React.PointerEvent<T>>;
  elementRef?: React.RefObject<Nullable<T>>;
  capturePointer?: boolean;
  releaseOnOutsideClick?: boolean;
  onPointerDown?: Procedure<React.PointerEvent<T>>;
  onPointerMove?: Procedure<React.PointerEvent<T>>;
  onPointerUp?: Procedure<React.PointerEvent<T>>;
  onPointerCancel?: Procedure<React.PointerEvent<T>>;
}

export interface UsePointerDragReturn<T extends HTMLElement = HTMLElement> {
  isDragging: boolean;
  pointerProps: {
    onPointerDown: (e: React.PointerEvent<T>) => void;
    onPointerMove: (e: React.PointerEvent<T>) => void;
    onPointerUp: (e: React.PointerEvent<T>) => void;
    onPointerCancel: (e: React.PointerEvent<T>) => void;
  };
}

export function usePointerDrag<T extends HTMLElement = HTMLElement>({
  disabled = false,
  onDragStart,
  onDrag,
  onDragEnd,
  onDragCancel,
  elementRef,
  capturePointer = true,
  releaseOnOutsideClick = false,
  onPointerDown: externalOnPointerDown,
  onPointerMove: externalOnPointerMove,
  onPointerUp: externalOnPointerUp,
  onPointerCancel: externalOnPointerCancel,
}: UsePointerDragOptions<T>): UsePointerDragReturn<T> {
  const [isDragging, setIsDragging] = React.useState(false);
  const startPos = React.useRef<Point>({ x: 0, y: 0 });

  const onDragStartRef = useCallbackRef(onDragStart);
  const onDragRef = useCallbackRef(onDrag);
  const onDragEndRef = useCallbackRef(onDragEnd);
  const onDragCancelRef = useCallbackRef(onDragCancel);

  const onDragTakesEvent = React.useMemo(() => {
    if (!onDrag) {
      return false;
    }
    return onDrag.length === 2;
  }, [onDrag]);
  const externalOnPointerDownRef = useCallbackRef(externalOnPointerDown);
  const externalOnPointerMoveRef = useCallbackRef(externalOnPointerMove);
  const externalOnPointerUpRef = useCallbackRef(externalOnPointerUp);
  const externalOnPointerCancelRef = useCallbackRef(externalOnPointerCancel);

  const handlePointerDown = React.useCallback(
    (e: React.PointerEvent<T>) => {
      if (disabled) {
        return;
      }
      e.preventDefault();
      setIsDragging(true);
      startPos.current = { x: e.clientX, y: e.clientY };

      if (capturePointer) {
        const target = elementRef?.current || e.currentTarget;
        if (target instanceof HTMLElement) {
          target.setPointerCapture(e.pointerId);
        }
      }

      onDragStartRef(e);
    },
    [disabled, onDragStartRef, elementRef, capturePointer]
  );

  const handlePointerMove = React.useCallback(
    (e: React.PointerEvent<T>) => {
      if (!isDragging || disabled) {
        return;
      }

      if (capturePointer) {
        const target = elementRef?.current || e.currentTarget;
        if (
          target instanceof HTMLElement &&
          !target.hasPointerCapture(e.pointerId)
        ) {
          setIsDragging(false);
          startPos.current = { x: 0, y: 0 };
          return;
        }
      }

      const deltaValue: Point = {
        x: e.clientX - startPos.current.x,
        y: startPos.current.y - e.clientY,
      };

      if (!onDragRef) {
        return;
      }

      if (onDragTakesEvent) {
        assertType<(evt: React.PointerEvent<T>, d: Point) => void>(onDragRef);
        onDragRef(e, deltaValue);
      } else {
        assertType<(d: Point) => void>(onDragRef);
        onDragRef(deltaValue);
      }
    },
    [
      disabled,
      isDragging,
      onDragRef,
      onDragTakesEvent,
      capturePointer,
      elementRef,
    ]
  );

  const handlePointerUp = React.useCallback(
    (e: React.PointerEvent<T>) => {
      if (isDragging) {
        setIsDragging(false);
        startPos.current = { x: 0, y: 0 };
        if (capturePointer) {
          const target = elementRef?.current || e.currentTarget;
          if (
            target instanceof HTMLElement &&
            target.hasPointerCapture(e.pointerId)
          ) {
            target.releasePointerCapture(e.pointerId);
          }
        }
        onDragEndRef(e);
      }
    },
    [isDragging, onDragEndRef, elementRef, capturePointer]
  );

  const handlePointerCancel = React.useCallback(
    (e: React.PointerEvent<T>) => {
      if (isDragging) {
        setIsDragging(false);
        startPos.current = { x: 0, y: 0 };
        if (capturePointer) {
          const target = elementRef?.current || e.currentTarget;
          if (
            target instanceof HTMLElement &&
            target.hasPointerCapture(e.pointerId)
          ) {
            target.releasePointerCapture(e.pointerId);
          }
        }
        onDragCancelRef(e);
      }
    },
    [isDragging, onDragCancelRef, elementRef, capturePointer]
  );

  const composedPointerDown = React.useMemo(
    () => (e: React.PointerEvent<T>) => {
      externalOnPointerDownRef?.(e);
      handlePointerDown(e);
    },
    [externalOnPointerDownRef, handlePointerDown]
  );

  const composedPointerMove = React.useMemo(
    () => (e: React.PointerEvent<T>) => {
      externalOnPointerMoveRef?.(e);
      handlePointerMove(e);
    },
    [externalOnPointerMoveRef, handlePointerMove]
  );

  const composedPointerUp = React.useMemo(
    () => (e: React.PointerEvent<T>) => {
      externalOnPointerUpRef?.(e);
      handlePointerUp(e);
    },
    [externalOnPointerUpRef, handlePointerUp]
  );

  const composedPointerCancel = React.useMemo(
    () => (e: React.PointerEvent<T>) => {
      externalOnPointerCancelRef?.(e);
      handlePointerCancel(e);
    },
    [externalOnPointerCancelRef, handlePointerCancel]
  );

  const pointerProps = React.useMemo(
    () => ({
      onPointerDown: composedPointerDown,
      onPointerMove: composedPointerMove,
      onPointerUp: composedPointerUp,
      onPointerCancel: composedPointerCancel,
    }),
    [
      composedPointerDown,
      composedPointerMove,
      composedPointerUp,
      composedPointerCancel,
    ]
  );

  React.useEffect(() => {
    if (!releaseOnOutsideClick) {
      return;
    }
    if (!isDragging) {
      return;
    }
    if (!elementRef) {
      return;
    }

    const abortController = new AbortController();
    const { signal } = abortController;

    const handleDocumentPointerDown = (e: PointerEvent) => {
      if (signal.aborted) {
        return;
      }

      const target = e.target;
      if (!(target instanceof Node)) {
        return;
      }
      assertType<Node>(target);
      const element = elementRef.current;
      if (!element) {
        return;
      }

      const isInside = element.contains(target);
      if (!isInside) {
        releaseAllPointerCaptures(element);
        setIsDragging(false);
        startPos.current = { x: 0, y: 0 };
      }
    };

    document.addEventListener("pointerdown", handleDocumentPointerDown, {
      capture: true,
      signal,
    });

    return () => {
      abortController.abort();
    };
  }, [isDragging, elementRef, releaseOnOutsideClick]);

  return {
    isDragging,
    pointerProps,
  };
}
