"use client";

import { useTheme as useNextTheme } from "next-themes";
import React from "react";

import { META_THEME_COLORS } from "@/lib/metadata";

function useTheme() {
  const { setTheme, resolvedTheme } = useNextTheme();
  const setMetaColor = React.useCallback((color: string) => {
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", color);
  }, []);

  const metaColor =
    resolvedTheme !== "dark" ? META_THEME_COLORS.light : META_THEME_COLORS.dark;

  const toggleTheme = React.useCallback(() => {
    const newTheme = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    setMetaColor(
      newTheme === "dark" ? META_THEME_COLORS.dark : META_THEME_COLORS.light
    );
  }, [resolvedTheme, setTheme, setMetaColor]);

  return {
    setTheme,
    resolvedTheme,
    metaColor,
    setMetaColor,
    toggleTheme,
  };
}
export { useTheme };
