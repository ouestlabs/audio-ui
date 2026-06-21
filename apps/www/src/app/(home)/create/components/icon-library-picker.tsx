"use client";

import { cn } from "@/registry/default/lib/utils";
import { Label } from "@/registry/default/ui/label";
import {
  ICON_LIBRARY_VALUES,
  type IconLibraryValue,
} from "../lib/search-params";
import { useBuilder } from "./builder-provider";

export function IconLibraryPicker() {
  const { params, setParams } = useBuilder();

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-muted-foreground text-xs uppercase tracking-wider">
        Icon Library
      </Label>
      <div className="flex flex-col gap-1.5">
        {ICON_LIBRARY_VALUES.map((lib) => (
          <button
            className={cn(
              "rounded-lg border px-3 py-2 text-left text-sm capitalize transition-colors",
              params.iconLibrary === lib
                ? "border-primary bg-primary/10 font-medium text-primary"
                : "border-border bg-transparent text-muted-foreground hover:border-border/80 hover:bg-muted/50 hover:text-foreground"
            )}
            key={lib}
            onClick={() => setParams({ iconLibrary: lib as IconLibraryValue })}
            type="button"
          >
            {lib}
          </button>
        ))}
      </div>
    </div>
  );
}
