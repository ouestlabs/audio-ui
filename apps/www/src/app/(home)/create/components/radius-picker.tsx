"use client";

import { cn } from "@/registry/default/lib/utils";
import { Label } from "@/registry/default/ui/label";
import {
  RADIUS_LABELS,
  RADIUS_VALUES,
  type RadiusValue,
} from "../lib/search-params";
import { useBuilder } from "./builder-provider";

export function RadiusPicker() {
  const { params, setParams } = useBuilder();

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-muted-foreground text-xs uppercase tracking-wider">
        Radius
      </Label>
      <div className="grid grid-cols-2 gap-1.5">
        {RADIUS_VALUES.map((r) => (
          <button
            className={cn(
              "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
              params.radius === r
                ? "border-primary bg-primary/10 font-medium text-primary"
                : "border-border bg-transparent text-muted-foreground hover:border-border/80 hover:bg-muted/50 hover:text-foreground"
            )}
            key={r}
            onClick={() => setParams({ radius: r as RadiusValue })}
            type="button"
          >
            {RADIUS_LABELS[r]}
          </button>
        ))}
      </div>
    </div>
  );
}
