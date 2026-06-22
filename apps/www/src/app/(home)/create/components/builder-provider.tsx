"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
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
const MANAGED_BODY_CLASS_PREFIXES = [
  "style-",
  "base-color-",
  "menu-color-",
  "menu-accent-",
] as const;

const ACCENT_VAR_KEYS = [
  "primary",
  "primary-foreground",
  "ring",
  "sidebar-primary",
  "sidebar-primary-foreground",
  "sidebar-ring",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
] as const;

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
  canGoBack: boolean;
  canGoForward: boolean;
  goBack: () => void;
  goForward: () => void;
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

  // --- History ---
  const [history, setHistory] = useState<BuilderSearchParams[]>([]);
  const [future, setFuture] = useState<BuilderSearchParams[]>([]);
  const isNavigatingRef = useRef(false);
  const prevParamsRef = useRef<BuilderSearchParams | null>(null);

  useEffect(() => {
    if (isNavigatingRef.current) {
      isNavigatingRef.current = false;
      prevParamsRef.current = params;
      return;
    }
    if (prevParamsRef.current !== null) {
      const snapshot = prevParamsRef.current;
      setHistory((h) => [...h.slice(-50), snapshot]);
      setFuture([]);
    }
    prevParamsRef.current = params;
  }, [params]);

  const goBack = useCallback(() => {
    if (history.length === 0) {
      return;
    }
    const prev = history.at(-1) as BuilderSearchParams;
    isNavigatingRef.current = true;
    setHistory((h) => h.slice(0, -1));
    setFuture((f) => [params, ...f.slice(0, 50)]);
    setParams(prev);
  }, [history, params, setParams]);

  const goForward = useCallback(() => {
    const next = future.at(0);
    if (!next) {
      return;
    }
    isNavigatingRef.current = true;
    setHistory((h) => [...h, params]);
    setFuture(future.slice(1));
    setParams(next);
  }, [future, params, setParams]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const modifierHeld = e.metaKey || e.ctrlKey;
      const inTextField =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement;
      if (!modifierHeld || inTextField) {
        return;
      }
      const isRedo = (e.key === "z" && e.shiftKey) || e.key === "y";
      if (isRedo) {
        e.preventDefault();
        goForward();
      } else if (e.key === "z") {
        e.preventDefault();
        goBack();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goBack, goForward]);

  // --- Cleanup on unmount ---
  useEffect(
    () => () => {
      removeManagedBodyClasses(document.body);
      document.getElementById(THEME_STYLE_ELEMENT_ID)?.remove();
    },
    []
  );

  // Sync mode param to next-themes
  useEffect(() => {
    setTheme(params.mode);
  }, [params.mode, setTheme]);

  // Apply body classes synchronously before paint
  useLayoutEffect(() => {
    const body = document.body;
    removeManagedBodyClasses(body);
    body.classList.add(
      `style-${params.style}`,
      `base-color-${params.baseColor}`,
      `menu-color-${params.menuColor}`,
      `menu-accent-${params.menuAccent}`
    );
    setIsReady(true);
  }, [params.style, params.baseColor, params.menuColor, params.menuAccent]);

  // Inject CSS vars
  useLayoutEffect(() => {
    const baseEntry =
      baseColorsOKLCH[params.baseColor as keyof typeof baseColorsOKLCH];
    if (!baseEntry) {
      return;
    }

    const themeEntry =
      baseColorsOKLCH[params.theme as keyof typeof baseColorsOKLCH];
    const effectiveRadius =
      params.style === "base-lyra" ? "none" : params.radius;
    const radiusValue =
      RADIUS_CSS[effectiveRadius as keyof typeof RADIUS_CSS] ??
      RADIUS_CSS[params.radius];

    const merge = (mode: "light" | "dark"): Record<string, string> => {
      const vars: Record<string, string> = { ...baseEntry[mode] };
      const themeVars = themeEntry?.[mode] as
        | Record<string, string>
        | undefined;
      if (themeVars) {
        for (const key of ACCENT_VAR_KEYS) {
          if (themeVars[key]) {
            vars[key] = themeVars[key];
          }
        }
      }
      vars.radius = radiusValue;
      return vars;
    };

    const cssText = [
      buildCssRule(":root", merge("light")),
      buildCssRule(".dark", merge("dark")),
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
  }, [params.baseColor, params.theme, params.radius, params.style]);

  if (!isReady) {
    return null;
  }

  return (
    <BuilderContext.Provider
      value={{
        params,
        setParams,
        canGoBack: history.length > 0,
        canGoForward: future.length > 0,
        goBack,
        goForward,
      }}
    >
      {children}
    </BuilderContext.Provider>
  );
}
