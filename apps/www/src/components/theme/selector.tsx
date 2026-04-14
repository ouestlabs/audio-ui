"use client";

import { THEMES } from "@/lib/themes";
import { cn } from "@/registry/default/lib/utils";
import { Label } from "@/registry/default/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/registry/default/ui/select";
import { useThemeConfig } from "./active";
import { CopyCodeButton } from "./customizer";

export function ThemeSelector({ className }: React.ComponentProps<"div">) {
  const { activeTheme, setActiveTheme } = useThemeConfig();

  const value = activeTheme === "default" ? "neutral" : activeTheme;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Label className="sr-only" htmlFor="theme-selector">
        Theme
      </Label>
      <Select onValueChange={(v) => v && setActiveTheme(v)} value={value}>
        <SelectTrigger
          className="justify-start border-secondary bg-secondary text-secondary-foreground shadow-none *:data-[slot=select-value]:w-12"
          id="theme-selector"
          size="sm"
        >
          <span className="font-medium">Theme:</span>
          <SelectValue placeholder="Select a theme" />
        </SelectTrigger>
        <SelectContent align="end">
          {THEMES.map((theme) => (
            <SelectItem
              className="data-[state=checked]:opacity-50"
              key={theme.name}
              value={theme.name}
            >
              {theme.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <CopyCodeButton size="icon-sm" variant="secondary" />
    </div>
  );
}
