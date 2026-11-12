"use client";

import { CheckIcon, CopyIcon } from "@phosphor-icons/react/ssr";
import { useCallback } from "react";
import { ACTION_BUTTON_CLASS } from "@/components/customizer/actions/action-button";
import { Button } from "@/components/ui/button";
import { useConfig } from "@/hooks/use-config";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { useDensity, useSize } from "@/hooks/use-look";
import { useStyling } from "@/hooks/use-styling";
import { useDesignSystemSearchParams } from "@/lib/design-system/search-params";
import { themeStylesheet } from "@/lib/design-system/theme-stylesheet";
import { DEFAULT_CONFIG } from "@/registry/config";

/** The theme on screen as CSS, in the styling the examples show, for the custom elements in a project of any framework: one click copies it. */
export function CopyCss() {
  const [params] = useDesignSystemSearchParams();
  const [config] = useConfig();
  const [styling] = useStyling();
  const [size] = useSize();
  const [density] = useDensity();
  const { copyToClipboard, isCopied } = useCopyToClipboard();
  const label = styling === "tailwind" ? "Copy Tailwind theme" : "Copy CSS";
  const shown = isCopied ? "Copied" : label;

  const copy = useCallback(() => {
    // The URL's choices first, the saved ones after, as the page applies them.
    copyToClipboard(
      themeStylesheet(
        {
          ...DEFAULT_CONFIG,
          baseColor: params.baseColor ?? config.baseColor,
          chartColor: params.chartColor ?? config.chartColor,
          font: params.font ?? config.font,
          menuAccent: params.menuAccent ?? config.menuAccent,
          radius: params.radius ?? config.radius,
          style: params.style ?? config.style,
          theme: params.theme ?? config.theme,
        },
        styling,
        { density, size }
      )
    );
  }, [config, copyToClipboard, density, params, size, styling]);

  return (
    <Button
      aria-label={
        styling === "tailwind"
          ? "Copy the Tailwind theme"
          : "Copy the theme as CSS"
      }
      className={ACTION_BUTTON_CLASS}
      onClick={copy}
      size="sm"
      variant="ghost"
    >
      <div className="flex min-w-0 flex-col justify-start text-left">
        <div className="text-site-muted-foreground text-xs">Export</div>
        <div className="truncate font-medium text-site-foreground text-sm">
          {shown}
        </div>
      </div>
      {isCopied ? (
        <CheckIcon aria-hidden="true" />
      ) : (
        <CopyIcon aria-hidden="true" />
      )}
    </Button>
  );
}
