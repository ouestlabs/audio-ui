"use client";

import { MoonIcon, SunIcon } from "@phosphor-icons/react/dist/ssr";
import posthog from "posthog-js";
import { useCallback } from "react";
import { useTheme } from "@/hooks/use-theme";
import { useSound } from "@/registry/bases/base/hooks/use-sound";
import { Button } from "@/registry/bases/base/ui/button";
import { Kbd, KbdGroup } from "@/registry/bases/base/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/registry/bases/base/ui/tooltip";

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
      <TooltipTrigger
        render={
          <Button onClick={handleToggleTheme} size="icon" variant="outline" />
        }
      >
        <MoonIcon className="dark:hidden" />
        <SunIcon className="hidden dark:block" />
        <span className="sr-only">Toggle theme</span>
      </TooltipTrigger>
      <TooltipContent sideOffset={8}>
        {resolvedTheme === "dark" ? (
          <KbdGroup>
            Switch to light mode
            <Kbd>
              <SunIcon />
            </Kbd>
          </KbdGroup>
        ) : (
          <KbdGroup>
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
