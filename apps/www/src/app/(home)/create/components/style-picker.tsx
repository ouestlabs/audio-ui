"use client";

import { cn } from "@/registry/default/lib/utils";
import { Label } from "@/registry/default/ui/label";
import { STYLES, type Style } from "@/registry/styles";
import { useBuilder } from "./builder-provider";

export function StylePicker() {
  const { params, setParams } = useBuilder();

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-muted-foreground text-xs uppercase tracking-wider">
        Style
      </Label>
      <div className="grid grid-cols-2 gap-1.5">
        {STYLES.map((style) => (
          <button
            className={cn(
              "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
              params.style === style
                ? "border-primary bg-primary/10 font-medium text-primary"
                : "border-border bg-transparent text-muted-foreground hover:border-border/80 hover:bg-muted/50 hover:text-foreground"
            )}
            key={style}
            onClick={() => setParams({ style: style as Style })}
            type="button"
          >
            {style.replace("base-", "")}
          </button>
        ))}
      </div>
    </div>
  );
}
