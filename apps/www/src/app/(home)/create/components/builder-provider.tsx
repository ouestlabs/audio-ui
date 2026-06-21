"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";
import { useTheme } from "@/hooks/use-theme";
import { baseColorsOKLCH } from "@/registry/base-colors";
import {
  type BuilderSearchParams,
  RADIUS_CSS,
  useBuilderSearchParams,
} from "../lib/search-params";

const THEME_STYLE_ELEMENT_ID = "builder-theme-vars";
const MANAGED_BODY_CLASS_PREFIXES = ["style-", "base-color-"] as const;

function removeManagedBodyClasses(body: HTMLElement) {
  for (const className of Array.from(body.classList)) {
    if (
      MANAGED_BODY_CLASS_PREFIXES.some((prefix) => className.startsWith(prefix))
    ) {
      body.classList.remove(className);
    }
  }
}

function buildCssRule(selector: string, vars?: Record<string, string>) {
  const declarations = Object.entries(vars ?? {})
    .filter(([, v]) => Boolean(v))
    .map(([k, v]) => `  --${k}: ${v};`)
    .join("\n");
  if (!declarations) {
    return `${selector} {}\n`;
  }
  return `${selector} {\n${declarations}\n}\n`;
}

type BuilderContextType = {
  params: BuilderSearchParams;
  setParams: ReturnType<typeof useBuilderSearchParams>[1];
};

const BuilderContext = createContext<BuilderContextType | undefined>(undefined);

export function useBuilder() {
  const ctx = useContext(BuilderContext);
  if (!ctx) {
    throw new Error("useBuilder must be used within BuilderProvider");
  }
  return ctx;
}

export function BuilderProvider({ children }: { children: ReactNode }) {
  const [params, setParams] = useBuilderSearchParams();
  const [isReady, setIsReady] = useState(false);
  const { setTheme } = useTheme();

  // Sync mode param to next-themes
  useEffect(() => {
    setTheme(params.mode);
  }, [params.mode, setTheme]);

  // Cleanup on unmount
  useEffect(
    () => () => {
      removeManagedBodyClasses(document.body);
      document.getElementById(THEME_STYLE_ELEMENT_ID)?.remove();
    },
    []
  );

  // Apply body classes synchronously before paint
  useLayoutEffect(() => {
    const body = document.body;
    removeManagedBodyClasses(body);
    body.classList.add(
      `style-${params.style}`,
      `base-color-${params.baseColor}`
    );
    setIsReady(true);
  }, [params.style, params.baseColor]);

  // Inject CSS vars for the selected base color
  useLayoutEffect(() => {
    const colorEntry =
      baseColorsOKLCH[params.baseColor as keyof typeof baseColorsOKLCH];
    if (!colorEntry) {
      return;
    }

    const radiusValue = RADIUS_CSS[params.radius];
    const rootVars: Record<string, string> = {
      ...colorEntry.light,
      radius: radiusValue,
    };
    const darkVars: Record<string, string> = {
      ...colorEntry.dark,
      radius: radiusValue,
    };

    const cssText = [
      buildCssRule(":root", rootVars),
      buildCssRule(".dark", darkVars),
    ].join("\n");

    let el = document.getElementById(
      THEME_STYLE_ELEMENT_ID
    ) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = THEME_STYLE_ELEMENT_ID;
      document.head.appendChild(el);
    }
    el.textContent = cssText;
  }, [params.baseColor, params.radius]);

  if (!isReady) {
    return null;
  }

  return (
    <BuilderContext.Provider value={{ params, setParams }}>
      {children}
    </BuilderContext.Provider>
  );
}
