"use client";

import { CheckIcon, CopyIcon } from "@phosphor-icons/react/ssr";
import { useCallback } from "react";
import { ACTION_BUTTON_CLASS } from "@/components/customizer/actions/action-button";
import { Button } from "@/components/ui/button";
import { useConfig } from "@/hooks/use-config";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { useStyling } from "@/hooks/use-styling";
import { useDesignSystemSearchParams } from "@/lib/design-system/search-params";
import { themeStylesheet } from "@/lib/design-system/theme-stylesheet";
import { DEFAULT_CONFIG } from "@/registry/config";

/** The theme on screen as CSS, in the styling the examples show, for the custom elements in a project of any framework: one click copies it. */
export function CopyCss() {
  const [params] = useDesignSystemSearchParams();
  const [config] = useConfig();
  const [styling] = useStyling();
  const { copyToClipboard, isCopied } = useCopyToClipboard();

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
        styling
      )
    );
  }, [config, copyToClipboard, params, styling]);

  return (
    <Button
      aria-label="Copy the theme as CSS"
      className={ACTION_BUTTON_CLASS}
      onClick={copy}
      size="sm"
      variant="ghost"
    >
      <div className="flex min-w-0 flex-col justify-start text-left">
        <div className="text-site-muted-foreground text-xs">Theme</div>
        <div className="truncate font-medium text-site-foreground text-sm">
          {isCopied ? "Copied" : "Copy CSS"}
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
