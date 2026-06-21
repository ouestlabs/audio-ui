"use client";

import { cn } from "@/registry/default/lib/utils";
import { Label } from "@/registry/default/ui/label";
import { BASE_COLOR_NAMES } from "../lib/search-params";
import { useBuilder } from "./builder-provider";

export function BaseColorPicker() {
  const { params, setParams } = useBuilder();

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-muted-foreground text-xs uppercase tracking-wider">
        Base Color
      </Label>
      <div className="grid grid-cols-2 gap-1.5">
        {BASE_COLOR_NAMES.map((color) => (
          <button
            className={cn(
              "rounded-lg border px-3 py-2 text-left text-sm capitalize transition-colors",
              params.baseColor === color
                ? "border-primary bg-primary/10 font-medium text-primary"
                : "border-border bg-transparent text-muted-foreground hover:border-border/80 hover:bg-muted/50 hover:text-foreground"
            )}
            key={color}
            onClick={() => setParams({ baseColor: color })}
            type="button"
          >
            {color}
          </button>
        ))}
      </div>
    </div>
  );
}
