import {
  EmptyProcedure,
  type Func,
  isNotUndefined,
  isUndefined,
  type Optional,
  type Procedure,
} from "@audio-ui/utils";
import * as React from "react";
import { useCallbackRef } from "../use-callback-ref";

export interface UseControlledValueOptions<T> {
  value?: T;
  defaultValue?: T;
  onChange?: Procedure<T>;
  transform?: Func<T, T>;
}

export interface UseControlledValueReturn<T> {
  value: Optional<T>;
  setValue: Procedure<T>;
}

export function useControlledValue<T>({
  value: controlledValue,
  defaultValue,
  onChange,
  transform,
}: UseControlledValueOptions<T>): UseControlledValueReturn<T> {
  const [internalValue, setInternalValue] =
    React.useState<Optional<T>>(defaultValue);

  const isControlled = isNotUndefined(controlledValue);
  const rawValue = isControlled ? controlledValue : internalValue;

  const onChangeRef = useCallbackRef(onChange ?? EmptyProcedure);

  const value = React.useMemo(() => {
    if (isUndefined(rawValue)) {
      return rawValue;
    }
    return transform ? transform(rawValue) : rawValue;
  }, [rawValue, transform]);

  const setValue = React.useCallback(
    (newValue: T) => {
      const transformedValue = transform ? transform(newValue) : newValue;
      if (!isControlled) {
        setInternalValue(transformedValue);
      }
      onChangeRef(transformedValue);
    },
    [isControlled, onChangeRef, transform]
  );

  return {
    value,
    setValue,
  };
}
