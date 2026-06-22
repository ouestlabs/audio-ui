"use client";

import { EqualsIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { useBuilder } from "./builder-provider";
import {
  Picker,
  PickerContent,
  PickerGroup,
  PickerItem,
  PickerSeparator,
  PickerShortcut,
  PickerTrigger,
} from "./picker";

const APPLE_PLATFORM_REGEX = /Mac|iPhone|iPad|iPod/;

// Setting a nuqs param to null removes it from the URL, falling back to its .withDefault() value.
const RESET_ALL = Object.fromEntries(
  [
    "style",
    "theme",
    "baseColor",
    "radius",
    "font",
    "fontHeading",
    "iconLibrary",
    "mode",
    "menuColor",
    "menuAccent",
  ].map((key) => [key, null])
);

export function MainMenu() {
  const { params, setParams, canGoBack, canGoForward, goBack, goForward } =
    useBuilder();
  const [isMac, setIsMac] = useState(false);
  const isDark = params.mode === "dark";

  useEffect(() => {
    setIsMac(
      APPLE_PLATFORM_REGEX.test(navigator.platform || navigator.userAgent)
    );
  }, []);

  return (
    <Picker>
      <PickerTrigger className="w-auto gap-1.5 rounded-lg px-2.5 py-1.5 ring-0">
        <span className="font-medium text-sm">Customize</span>
        <EqualsIcon aria-hidden="true" className="size-5" weight="bold" />
      </PickerTrigger>
      <PickerContent align="start" alignOffset={-8} side="right">
        <PickerGroup>
          <PickerItem disabled={!canGoBack} onClick={goBack}>
            Undo
            <PickerShortcut>{isMac ? "⌘Z" : "Ctrl+Z"}</PickerShortcut>
          </PickerItem>
          <PickerItem disabled={!canGoForward} onClick={goForward}>
            Redo
            <PickerShortcut>{isMac ? "⇧⌘Z" : "Ctrl+Shift+Z"}</PickerShortcut>
          </PickerItem>
        </PickerGroup>
        <PickerSeparator />
        <PickerGroup>
          <PickerItem
            onClick={() => setParams({ mode: isDark ? "light" : "dark" })}
          >
            {isDark ? "Switch to light mode" : "Switch to dark mode"}
          </PickerItem>
        </PickerGroup>
        <PickerSeparator />
        <PickerGroup>
          <PickerItem onClick={() => setParams(RESET_ALL)}>
            Reset
            <PickerShortcut>⇧R</PickerShortcut>
          </PickerItem>
        </PickerGroup>
      </PickerContent>
    </Picker>
  );
}
