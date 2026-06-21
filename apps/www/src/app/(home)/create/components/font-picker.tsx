"use client";

import { cn } from "@/registry/default/lib/utils";
import { Label } from "@/registry/default/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/registry/default/ui/select";
import { useBuilder } from "./builder-provider";

const FONT_OPTIONS = [
  { value: "inter", label: "Inter" },
  { value: "geist", label: "Geist" },
  { value: "geist-mono", label: "Geist Mono" },
  { value: "system", label: "System UI" },
] as const;

export function FontPicker() {
  const { params, setParams } = useBuilder();

  return (
    <div className="flex flex-col gap-2">
      <Label
        className="text-muted-foreground text-xs uppercase tracking-wider"
        htmlFor="font-select"
      >
        Font
      </Label>
      <Select onValueChange={(v) => setParams({ font: v })} value={params.font}>
        <SelectTrigger className={cn("w-full")} id="font-select">
          <SelectValue placeholder="Select font" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {FONT_OPTIONS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
