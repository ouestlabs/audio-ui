"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import posthog from "posthog-js";
import { useCallback } from "react";
import { useTheme } from "@/hooks/use-theme";
import { useSound } from "@/registry/default/hooks/use-sound";
import { Button } from "@/registry/default/ui/button";
import { Kbd, KbdGroup } from "@/registry/default/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/registry/default/ui/tooltip";

export function ThemeSwitcher() {
  const { resolvedTheme, toggleTheme } = useTheme();
  const playClick = useSound("/audio/ui-sounds/click.wav");

  const handleToggleTheme = useCallback(() => {
    playClick(0.5);
    posthog.capture("theme_toggled");
    toggleTheme();
  }, [toggleTheme, playClick]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button onClick={handleToggleTheme} size="icon-sm" variant="outline">
          <MoonIcon className="dark:hidden" />
          <SunIcon className="hidden dark:block" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent sideOffset={8}>
        {resolvedTheme === "dark" ? (
          <KbdGroup className="flex items-center gap-2.5">
            Switch to light mode
            <Kbd>
              <SunIcon />
            </Kbd>
          </KbdGroup>
        ) : (
          <KbdGroup className="flex items-center gap-2.5">
            Switch to dark mode
            <Kbd>
              <MoonIcon />
            </Kbd>
          </KbdGroup>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
