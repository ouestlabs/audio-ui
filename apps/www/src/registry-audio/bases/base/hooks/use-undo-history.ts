"use client";

import { useCallback, useRef, useState } from "react";
import {
  beginChange,
  canRedo,
  canUndo,
  emptyHistory,
  type History,
  recordChange,
  redo,
  settleChange,
  undo,
} from "@/registry-audio/bases/base/lib/undo-history";

/**
 * Undo and redo over a value you own, such as a clip's notes or an envelope's
 * points. `edit` records a change made in one go (a menu command, a key);
 * `change` is each step of a gesture, and `commit` ends it, so a whole drag
 * undoes as one.
 */
export function useUndoHistory<T>(value: T, setValue: (value: T) => void) {
  const historyRef = useRef<History<T>>(emptyHistory());
  const [history, setHistoryState] = useState(historyRef.current);
  const valueRef = useRef(value);
  valueRef.current = value;
  const setHistory = useCallback((next: History<T>) => {
    historyRef.current = next;
    setHistoryState(next);
  }, []);

  const edit = useCallback(
    (next: T) => {
      setHistory(recordChange(historyRef.current, valueRef.current));
      setValue(next);
    },
    [setHistory, setValue]
  );
  const change = useCallback(
    (next: T) => {
      setHistory(beginChange(historyRef.current, valueRef.current));
      setValue(next);
    },
    [setHistory, setValue]
  );
  const commit = useCallback(
    () => setHistory(settleChange(historyRef.current)),
    [setHistory]
  );
  const undoValue = useCallback(() => {
    const step = undo(historyRef.current, valueRef.current);
    if (step) {
      setHistory(step.history);
      setValue(step.present);
    }
  }, [setHistory, setValue]);
  const redoValue = useCallback(() => {
    const step = redo(historyRef.current, valueRef.current);
    if (step) {
      setHistory(step.history);
      setValue(step.present);
    }
  }, [setHistory, setValue]);

  return {
    canRedo: canRedo(history),
    canUndo: canUndo(history),
    change,
    commit,
    edit,
    redo: redoValue,
    undo: undoValue,
  };
}
