"use client";

import * as React from "react";
import { useMenuColor } from "@/components/customizer/use-menu-color";
import { useConfig } from "@/hooks/use-config";
import { saveDesignSystemBoot } from "@/lib/design-system/boot-cache";
import { ensurePreviewFontsLoaded, FONTS } from "@/lib/design-system/fonts";
import {
  getThemeStyleElement,
  writeThemeVars,
} from "@/lib/design-system/theme-vars";
import type { FontName } from "@/lib/font-definitions";
import { buildRegistryTheme, DEFAULT_CONFIG } from "@/registry/config";

function syncBodyStyleClass(styleClass: string) {
  const { body } = document;
  const styleClasses = Array.from(body.classList).filter((className) =>
    className.startsWith("style-")
  );

  if (
    styleClass &&
    styleClasses.length === 1 &&
    styleClasses[0] === styleClass
  ) {
    return;
  }

  body.classList.remove(...styleClasses);

  if (styleClass) {
    body.classList.add(styleClass);
  }
}

/**
 * Applies the stored design system (style, theme, fonts, radius, menu) to the
 * pages that do not read the URL. It renders nothing and wraps nothing, so the
 * page around it is rendered on the server as it is.
 */
export function DocsDesignSystemEffects() {
  const [config] = useConfig();
  useMenuColor(config.menuColor);

  // What is applied is kept for the next load, which puts it back before the first paint.
  React.useEffect(() => {
    saveDesignSystemBoot();
  });
  const previousStyleClassesRef = React.useRef<string[] | null>(null);
  const previousFontStateRef = React.useRef<{
    fontSans: string;
    fontHeading: string;
    bodyFontFamily: string;
  } | null>(null);
  const selectedFont = React.useMemo(
    () => FONTS.find((fontOption) => fontOption.value === config.font),
    [config.font]
  );
  const selectedHeadingFont = React.useMemo(() => {
    if (
      config.fontHeading === "inherit" ||
      config.fontHeading === config.font
    ) {
      return selectedFont;
    }

    return FONTS.find((fontOption) => fontOption.value === config.fontHeading);
  }, [config.fontHeading, config.font, selectedFont]);

  // The theme's colors and radius, and the base color, so the previews show what the customizer picks.
  React.useLayoutEffect(() => {
    const { body } = document;
    const { element } = getThemeStyleElement();
    const { cssVars } = buildRegistryTheme({
      ...DEFAULT_CONFIG,
      baseColor: config.baseColor,
      chartColor: config.chartColor ?? DEFAULT_CONFIG.chartColor,
      menuAccent: config.menuAccent,
      radius: config.style === "lyra" ? "none" : config.radius,
      theme: config.theme,
    });
    writeThemeVars(element, cssVars);
    for (const className of Array.from(body.classList)) {
      if (className.startsWith("base-color-")) {
        body.classList.remove(className);
      }
    }
    body.classList.add(`base-color-${config.baseColor}`);
  }, [
    config.baseColor,
    config.chartColor,
    config.menuAccent,
    config.radius,
    config.style,
    config.theme,
  ]);

  React.useLayoutEffect(() => {
    const { body } = document;
    const root = document.documentElement;
    const styleClass = `style-${config.style}`;

    if (!previousStyleClassesRef.current) {
      previousStyleClassesRef.current = Array.from(body.classList).filter(
        (className) => className.startsWith("style-")
      );
    }

    if (!previousFontStateRef.current) {
      previousFontStateRef.current = {
        bodyFontFamily: body.style.fontFamily,
        fontHeading: root.style.getPropertyValue("--font-heading"),
        fontSans: root.style.getPropertyValue("--font-sans"),
      };
    }

    syncBodyStyleClass(styleClass);

    // Registry config types fonts as plain strings; values are schema-validated font names.
    ensurePreviewFontsLoaded([config.font, config.fontHeading] as Array<
      FontName | "inherit" | undefined
    >);

    if (selectedFont) {
      root.style.setProperty("--font-sans", selectedFont.font.style.fontFamily);
      body.style.fontFamily = selectedFont.font.style.fontFamily;
    }

    if (selectedHeadingFont) {
      root.style.setProperty(
        "--font-heading",
        selectedHeadingFont.font.style.fontFamily
      );
    }

    const frameId = window.requestAnimationFrame(() => {
      syncBodyStyleClass(styleClass);
    });

    const observer = new MutationObserver(() => {
      syncBodyStyleClass(styleClass);
    });

    observer.observe(body, {
      attributeFilter: ["class"],
      attributes: true,
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [
    config.style,
    selectedFont,
    selectedHeadingFont,
    config.font,
    config.fontHeading,
  ]);

  React.useEffect(
    () => () => {
      syncBodyStyleClass("");

      const previousFontState = previousFontStateRef.current;

      if (previousFontState) {
        if (previousFontState.fontSans) {
          document.documentElement.style.setProperty(
            "--font-sans",
            previousFontState.fontSans
          );
        } else {
          document.documentElement.style.removeProperty("--font-sans");
        }

        if (previousFontState.fontHeading) {
          document.documentElement.style.setProperty(
            "--font-heading",
            previousFontState.fontHeading
          );
        } else {
          document.documentElement.style.removeProperty("--font-heading");
        }

        if (previousFontState.bodyFontFamily) {
          document.body.style.fontFamily = previousFontState.bodyFontFamily;
        } else {
          document.body.style.removeProperty("font-family");
        }
      }

      document.body.classList.add(...(previousStyleClassesRef.current ?? []));
    },
    []
  );

  return null;
}
