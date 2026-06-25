"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTheme } from "@/hooks/use-theme";
import { buildRegistryTheme } from "@/registry/config";
import {
  type BuilderSearchParams,
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

function applyMenuClasses(isInverted: boolean, isTranslucent: boolean) {
  const elements = document.querySelectorAll<HTMLElement>(
    ".cn-menu-target, [data-menu-translucent]"
  );
  if (elements.length === 0) {
    return;
  }
  for (const el of elements) {
    el.style.transition = "none";
  }
  for (const el of elements) {
    if (el.classList.contains("cn-menu-target")) {
      if (isInverted) {
        el.classList.add("dark");
      } else {
        el.classList.remove("dark");
      }
    }
    if (isTranslucent) {
      el.classList.add("cn-menu-translucent");
      el.removeAttribute("data-menu-translucent");
    } else if (el.classList.contains("cn-menu-translucent")) {
      el.classList.remove("cn-menu-translucent");
      el.setAttribute("data-menu-translucent", "");
    }
  }
  // Force reflow before re-enabling transitions to prevent flash.
  document.body.getBoundingClientRect();
  for (const el of elements) {
    el.style.transition = "";
  }
}

// Disables CSS transitions for the current paint, re-enables on next frame.
// Same technique as next-themes' disableTransitionOnChange, but synchronous.
function suppressTransitions(): () => void {
  const style = document.createElement("style");
  style.textContent =
    "*,*::before,*::after{transition:none!important;animation-duration:0s!important}";
  document.head.appendChild(style);
  const id = window.requestAnimationFrame(() => {
    if (document.head.contains(style)) {
      document.head.removeChild(style);
    }
  });
  return () => {
    window.cancelAnimationFrame(id);
    if (document.head.contains(style)) {
      document.head.removeChild(style);
    }
  };
}

function applyThemeToDom(mode: "light" | "dark") {
  const html = document.documentElement;
  if (mode === "dark") {
    html.classList.add("dark");
    html.style.colorScheme = "dark";
  } else {
    html.classList.remove("dark");
    html.style.colorScheme = "light";
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
  const { setTheme, resolvedTheme } = useTheme();

  // next-themes 0.4.x creates a new setTheme reference on every theme change.
  // Storing in a ref lets us call it without listing it as an effect dependency.
  const setThemeRef = useRef(setTheme);
  setThemeRef.current = setTheme;

  // Always holds the latest params.mode so Effect 2 can read it without listing
  // params.mode as a dep (which would cause it to fire when customizer changes mode).
  const modeRef = useRef(params.mode);
  modeRef.current = params.mode;

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

  // Apply .dark class synchronously BEFORE paint to prevent flash.
  // No setTheme call here — calling next-themes setState from useLayoutEffect
  // causes a synchronous re-render loop. DOM update only; next-themes sync is
  // handled by the separate useEffect below.
  useLayoutEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    if (isDark === (params.mode === "dark")) {
      return;
    }
    applyThemeToDom(params.mode);
    return suppressTransitions();
  }, [params.mode]);

  // Sync params.mode → next-themes (async, after paint, no loop risk).
  useEffect(() => {
    setThemeRef.current(params.mode);
  }, [params.mode]);

  // Sync next-themes → params.mode (global header toggle only).
  // Watches only resolvedTheme — does NOT list params.mode as a dep so it never
  // fires when the customizer changes params.mode (which would fight and revert it).
  // Reads current params.mode via modeRef to avoid stale closure.
  useEffect(() => {
    if (resolvedTheme !== "light" && resolvedTheme !== "dark") {
      return;
    }
    if (resolvedTheme !== modeRef.current) {
      isNavigatingRef.current = true;
      setParams({ mode: resolvedTheme });
    }
  }, [resolvedTheme, setParams]);

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

  // Compute CSS vars from config (menuAccent: bold swaps accent → primary)
  const registryTheme = useMemo(
    () =>
      buildRegistryTheme({
        baseColor: params.baseColor,
        theme: params.theme,
        radius: params.radius,
        style: params.style,
        menuAccent: params.menuAccent,
      }),
    [
      params.baseColor,
      params.theme,
      params.radius,
      params.style,
      params.menuAccent,
    ]
  );

  // Inject CSS vars synchronously before paint
  useLayoutEffect(() => {
    const { theme: themeVars, light, dark } = registryTheme.cssVars;

    const cssText = [
      buildCssRule(":root", { ...(themeVars ?? {}), ...(light ?? {}) }),
      buildCssRule(".dark", dark),
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
  }, [registryTheme]);

  // Handle menu color: add/remove .dark and .cn-menu-translucent on menu elements.
  // Uses MutationObserver so portals that open after mount are also updated.
  useLayoutEffect(() => {
    const isInverted =
      params.menuColor === "inverted" ||
      params.menuColor === "inverted-translucent";
    const isTranslucent =
      params.menuColor === "default-translucent" ||
      params.menuColor === "inverted-translucent";

    let frameId = 0;

    const update = () => {
      applyMenuClasses(isInverted, isTranslucent);
    };

    const schedule = () => {
      if (frameId) {
        return;
      }
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        applyMenuClasses(isInverted, isTranslucent);
      });
    };

    update();

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [params.menuColor]);

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
