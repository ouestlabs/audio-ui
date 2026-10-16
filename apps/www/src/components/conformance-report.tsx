"use client";

import { useEffect, useState } from "react";
import { ALL_CHECKS, type CheckResult } from "@/lib/conformance/checks";

type Row = { result?: CheckResult; error?: string } | undefined;

/** Runs every conformance check once, in order, and lists what each measured. */
export function ConformanceReport() {
  const [rows, setRows] = useState<Row[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      ALL_CHECKS.map(async (check, index) => {
        let row: Row;
        try {
          row = { result: await check.run() };
        } catch (error) {
          row = {
            error: error instanceof Error ? error.message : String(error),
          };
        }
        if (!cancelled) {
          setRows((current) => {
            const next = [...current];
            next[index] = row;
            return next;
          });
        }
      })
    ).then(() => {
      if (!cancelled) {
        setDone(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const passed = rows.filter((row) => row?.result?.pass).length;
  const failed = rows.filter((row) => row && !row.result?.pass).length;

  return (
    <div className="flex flex-col gap-4">
      <p
        className="font-mono text-sm"
        data-done={done || undefined}
        id="conformance-summary"
        role="status"
      >
        {done ? "Done" : "Running"}: {passed} passed, {failed} failed,{" "}
        {ALL_CHECKS.length} checks.
      </p>
      <ul className="flex flex-col divide-y border">
        {ALL_CHECKS.map((check, index) => {
          const row = rows[index];
          let state = "running";
          if (row) {
            state = row.result?.pass ? "pass" : "fail";
          }
          return (
            <li
              className="flex flex-col gap-1 p-3 text-sm"
              data-check={check.id}
              data-state={state}
              key={check.id + check.title}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">
                  {check.device}: {check.title}
                </span>
                <span
                  className={
                    state === "fail"
                      ? "font-mono text-destructive text-xs"
                      : "font-mono text-muted-foreground text-xs"
                  }
                >
                  {state}
                </span>
              </div>
              <span className="text-muted-foreground text-xs">
                Reference: {check.reference}
              </span>
              {row?.result ? (
                <span className="font-mono text-xs">
                  Measured {row.result.measured}. Expected {row.result.expected}
                  .
                </span>
              ) : null}
              {row?.error ? (
                <span className="font-mono text-destructive text-xs">
                  {row.error}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
