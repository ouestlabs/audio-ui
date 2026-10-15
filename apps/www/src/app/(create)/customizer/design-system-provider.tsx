"use client";

import * as React from "react";
import {
  isInIframe,
  useIframeMessageListener,
} from "@/app/(create)/hooks/use-iframe-sync";
import { saveDesignSystemBoot } from "@/app/(create)/lib/boot-cache";
import { ensurePreviewFontsLoaded, FONTS } from "@/app/(create)/lib/fonts";
import {
  type DesignSystemSearchParams,
  loadDesignSystemSearchParams,
  useDesignSystemSearchParams,
} from "@/app/(create)/lib/search-params";
import {
  getThemeStyleElement,
  writeThemeVars,
} from "@/app/(create)/lib/theme-vars";
import { useConfig } from "@/hooks/use-config";
import type { FontName } from "@/lib/font-definitions";
import {
  buildRegistryTheme,
  DEFAULT_CONFIG,
  type DesignSystemConfig,
  type IconLibraryName,
} from "@/registry/config";
import { useMenuColor } from "./use-menu-color";

interface DesignSystemContextValue {
  baseColor: string | null;
  chartColor: string | null;
  font: string | null;
  fontHeading: string | null;
  iconLibrary: IconLibraryName | null;
  menuAccent: string | null;
  menuColor: string | null;
  radius: string | null;
  style: string | null;
  theme: string | null;
}

export const DesignSystemContext =
  React.createContext<DesignSystemContextValue | null>(null);

export function useDesignSystem() {
  const context = React.use(DesignSystemContext);
  if (!context) {
    throw new Error(
      "useDesignSystem must be used within a DesignSystemProvider"
    );
  }
  return context;
}

// Keys to check for in URL to determine if design system params exist
export const DESIGN_SYSTEM_URL_KEYS = [
  "base",
  "style",
  "theme",
  "baseColor",
  "chartColor",
  "font",
  "fontHeading",
  "iconLibrary",
  "menuAccent",
  "menuColor",
  "radius",
  "item",
  "template",
  "size",
  "custom",
] as const;

/**
 * Sync-only provider for the host page.
 * Handles URL -> localStorage synchronization on mount (for deep links).
 * Use this in the patterns layout (host page).
 *
 * NOTE: This provider renders children immediately to avoid causing
 * child components to mount/unmount during hydration.
 */
export function DesignSystemSyncProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [_config, setConfig] = useConfig();
  const hasSyncedRef = React.useRef(false);

  // Initial sync on mount: URL -> localStorage only
  // Using useLayoutEffect to sync before paint, but still render children immediately
  React.useLayoutEffect(() => {
    if (hasSyncedRef.current) {
      return;
    }
    hasSyncedRef.current = true;

    const urlParams = new URLSearchParams(window.location.search);
    const hasDesignSystemParams = DESIGN_SYSTEM_URL_KEYS.some((key) =>
      urlParams.has(key)
    );

    if (hasDesignSystemParams) {
      // URL HAS params -> Sync them to localStorage (user arrived via deep link)
      const parsed = loadDesignSystemSearchParams(urlParams);

      setConfig((prev) => {
        const next = { ...prev };
        for (const key of DESIGN_SYSTEM_URL_KEYS) {
          if (urlParams.has(key)) {
            // @ts-expect-error
            next[key] = parsed[key];
          }
        }
        return next;
      });
    }
  }, [setConfig]); // Run only once on mount

  // Render children immediately - don't wait for sync to complete.
  return <>{children}</>;
}

/**
 * Full provider for the components preview shell.
 * Applies design system styles (CSS classes, CSS variables, fonts) to the page.
 * Same-origin embed messaging remains supported for legacy preview hosts.
 */
/**
 * Applies the design system (style, theme, fonts, radius, menu) to the page,
 * from the URL first and the stored choices after. It renders nothing and
 * wraps nothing: it sits beside the page, in a boundary of its own, because
 * reading the URL must not take the page's content with it.
 */
export function DesignSystemEffects() {
  const [params, setParams] = useDesignSystemSearchParams({
    history: "replace",
    shallow: true,
  });
  const [config, setConfig] = useConfig();

  // Sync design-system params from same-origin embed hosts via postMessage so
  // the preview can still react to externally controlled state.
  const handleDesignSystemMessage = React.useCallback(
    (nextParams: DesignSystemSearchParams) => {
      setParams(nextParams);
    },
    [setParams]
  );

  useIframeMessageListener("design-system-params", handleDesignSystemMessage);

  // Merge: params (URL / postMessage via setParams) > config (localStorage)
  const style = params.style ?? config.style;
  const theme = params.theme ?? config.theme;
  const font = params.font ?? config.font;
  const fontHeading =
    params.fontHeading ?? config.fontHeading ?? DEFAULT_CONFIG.fontHeading;
  const chartColor =
    params.chartColor ?? config.chartColor ?? DEFAULT_CONFIG.chartColor;
  const baseColor = params.baseColor ?? config.baseColor;
  const menuAccent = params.menuAccent ?? config.menuAccent;
  const menuColor = params.menuColor ?? config.menuColor;
  const radius = params.radius ?? config.radius;
  const iconLibrary = params.iconLibrary ?? config.iconLibrary;

  const effectiveRadius = style === "lyra" ? "none" : radius;

  const selectedFont = React.useMemo(
    () => FONTS.find((fontOption) => fontOption.value === font),
    [font]
  );

  const selectedHeadingFont = React.useMemo(() => {
    if (fontHeading === "inherit" || fontHeading === font) {
      return selectedFont;
    }
    return FONTS.find((fontOption) => fontOption.value === fontHeading);
  }, [font, fontHeading, selectedFont]);
  const previousDocumentStateRef = React.useRef<{
    styleClasses: string[];
    baseColorClasses: string[];
    fontSans: string;
    fontHeading: string;
    bodyFontFamily: string;
  } | null>(null);
  const previousThemeStyleRef = React.useRef<{
    existed: boolean;
    textContent: string;
  } | null>(null);

  React.useEffect(() => {
    if (style === "lyra" && radius !== "none") {
      setParams({ radius: "none" });
      setConfig((prev) => ({ ...prev, radius: "none" }));
    }
  }, [style, radius, setParams, setConfig]);

  const [isReady, setIsReady] = React.useState(false);

  // Use useLayoutEffect for synchronous style updates to prevent flash.
  React.useLayoutEffect(() => {
    if (!(style && theme && font && baseColor && iconLibrary)) {
      return;
    }

    const { body } = document;
    const root = document.documentElement;

    if (!previousDocumentStateRef.current) {
      previousDocumentStateRef.current = {
        baseColorClasses: Array.from(body.classList).filter((className) =>
          className.startsWith("base-color-")
        ),
        bodyFontFamily: body.style.fontFamily,
        fontHeading: root.style.getPropertyValue("--font-heading"),
        fontSans: root.style.getPropertyValue("--font-sans"),
        styleClasses: Array.from(body.classList).filter((className) =>
          className.startsWith("style-")
        ),
      };
    }

    // Update style class in place (remove old, add new).
    // A copy: removing from the live list while walking it would skip classes.
    for (const className of [...body.classList]) {
      if (className.startsWith("style-")) {
        body.classList.remove(className);
      }
    }
    body.classList.add(`style-${style}`);

    // Update base color class in place.
    for (const className of [...body.classList]) {
      if (className.startsWith("base-color-")) {
        body.classList.remove(className);
      }
    }
    body.classList.add(`base-color-${baseColor}`);

    // Body / UI font (--font-sans) and heading (--font-heading).
    // Registry config types fonts as plain strings; values are schema-validated font names.
    ensurePreviewFontsLoaded([font, fontHeading] as Array<
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

    setIsReady(true);
  }, [
    style,
    theme,
    font,
    fontHeading,
    baseColor,
    iconLibrary,
    selectedFont,
    selectedHeadingFont,
  ]);

  React.useEffect(
    () => () => {
      // Only restore the host page's original styling when embedded as an
      // iframe preview. For the app's own top-level navigation, a different
      // DesignSystemProvider instance is about to (or already did) apply its
      // own classes/vars on mount, undoing them here would just race it and
      // can leave body with no style-<name> class at all.
      if (!isInIframe()) {
        return;
      }

      const previousDocumentState = previousDocumentStateRef.current;
      const { body } = document;
      const root = document.documentElement;

      if (previousDocumentState) {
        for (const className of [...body.classList]) {
          if (
            className.startsWith("style-") ||
            className.startsWith("base-color-")
          ) {
            body.classList.remove(className);
          }
        }

        body.classList.add(
          ...previousDocumentState.styleClasses,
          ...previousDocumentState.baseColorClasses
        );

        if (previousDocumentState.fontSans) {
          root.style.setProperty("--font-sans", previousDocumentState.fontSans);
        } else {
          root.style.removeProperty("--font-sans");
        }

        if (previousDocumentState.fontHeading) {
          root.style.setProperty(
            "--font-heading",
            previousDocumentState.fontHeading
          );
        } else {
          root.style.removeProperty("--font-heading");
        }

        if (previousDocumentState.bodyFontFamily) {
          body.style.fontFamily = previousDocumentState.bodyFontFamily;
        } else {
          body.style.removeProperty("font-family");
        }
      }

      const styleElement = document.getElementById(
        "design-system-theme-vars"
      ) as HTMLStyleElement | null;

      if (!styleElement) {
        return;
      }

      if (previousThemeStyleRef.current?.existed) {
        styleElement.textContent = previousThemeStyleRef.current.textContent;
        return;
      }

      styleElement.remove();
    },
    []
  );

  const registryTheme = React.useMemo(() => {
    if (!(baseColor && theme && menuAccent && effectiveRadius && chartColor)) {
      return null;
    }

    const themeConfig: DesignSystemConfig = {
      ...DEFAULT_CONFIG,
      baseColor,
      chartColor,
      menuAccent,
      radius: effectiveRadius,
      theme,
    };

    return buildRegistryTheme(themeConfig);
  }, [baseColor, theme, chartColor, menuAccent, effectiveRadius]);

  // Use useLayoutEffect for synchronous CSS var updates.
  React.useLayoutEffect(() => {
    if (!registryTheme?.cssVars) {
      return;
    }

    const { element, existed } = getThemeStyleElement();

    if (!previousThemeStyleRef.current) {
      previousThemeStyleRef.current = {
        existed,
        textContent: existed ? element.textContent : "",
      };
    }

    writeThemeVars(element, registryTheme.cssVars);
  }, [registryTheme]);

  // Signal same-origin embed hosts once the preview is fully styled.
  React.useEffect(() => {
    if (isReady && isInIframe()) {
      window.parent.postMessage(
        { type: "iframe-ready" },
        window.location.origin
      );
    }
  }, [isReady]);

  // Keep same-origin embedded previews height-synced for legacy hosts.
  React.useEffect(() => {
    if (!(isReady && isInIframe())) {
      return;
    }

    let frameId = 0;
    let lastHeight = 0;

    const getDocumentHeight = () => {
      const root = document.documentElement;
      const { body } = document;

      return Math.ceil(
        Math.max(
          root.scrollHeight,
          body.scrollHeight,
          root.offsetHeight,
          body.offsetHeight,
          root.getBoundingClientRect().height,
          body.getBoundingClientRect().height
        )
      );
    };

    const postHeight = () => {
      frameId = 0;
      const nextHeight = getDocumentHeight();

      if (!nextHeight || Math.abs(nextHeight - lastHeight) < 2) {
        return;
      }

      lastHeight = nextHeight;
      window.parent.postMessage(
        { height: nextHeight, type: "iframe-height" },
        window.location.origin
      );
    };

    const scheduleHeightUpdate = () => {
      if (frameId) {
        return;
      }

      frameId = window.requestAnimationFrame(postHeight);
    };

    scheduleHeightUpdate();

    const resizeObserver = new ResizeObserver(() => {
      scheduleHeightUpdate();
    });

    resizeObserver.observe(document.documentElement);
    resizeObserver.observe(document.body);

    const mutationObserver = new MutationObserver(() => {
      scheduleHeightUpdate();
    });

    mutationObserver.observe(document.body, {
      characterData: true,
      childList: true,
      subtree: true,
    });

    window.addEventListener("resize", scheduleHeightUpdate);

    document.fonts?.ready?.then(scheduleHeightUpdate);

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }

      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("resize", scheduleHeightUpdate);
    };
  }, [isReady]);

  useMenuColor(menuColor);

  // What is applied is kept for the next load, which puts it back before the first paint.
  React.useEffect(() => {
    saveDesignSystemBoot();
  });

  return null;
}
