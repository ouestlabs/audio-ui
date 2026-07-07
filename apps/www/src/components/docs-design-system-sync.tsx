"use client";

import * as React from "react";
import { ensurePreviewFontsLoaded, FONTS } from "@/app/(create)/lib/fonts";
import { useConfig } from "@/hooks/use-config";
import type { FontName } from "@/lib/font-definitions";

function syncBodyStyleClass(styleClass: string) {
  const body = document.body;
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

  styleClasses.forEach((className) => {
    body.classList.remove(className);
  });

  if (styleClass) {
    body.classList.add(styleClass);
  }
}

export function DocsDesignSystemSync({
  children,
}: {
  children: React.ReactNode;
}) {
  const [config] = useConfig();
  const [ready, setReady] = React.useState(false);
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

  React.useLayoutEffect(() => {
    const body = document.body;
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

    setReady(true);

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

      previousStyleClassesRef.current?.forEach((className) => {
        document.body.classList.add(className);
      });
    },
    []
  );

  return (
    <div
      className={
        ready
          ? "flex flex-1 flex-col opacity-100"
          : "flex flex-1 flex-col opacity-0"
      }
      suppressHydrationWarning
    >
      {children}
    </div>
  );
}
