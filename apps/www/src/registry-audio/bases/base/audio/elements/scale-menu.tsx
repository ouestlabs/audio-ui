"use client";

import {
  pitchClassName,
  SCALES,
  type Scale,
  type ScaleName,
} from "@audio-ui/core/pitch";
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  use,
  useCallback,
  useMemo,
} from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import { Button } from "@/registry/bases/base/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/registry/bases/base/ui/dropdown-menu";

/** Each scale's name, as the menu writes it. */
export const SCALE_LABELS: Record<ScaleName, string> = {
  blues: "Blues",
  chromatic: "Chromatic",
  dorian: "Dorian",
  "harmonic-minor": "Harmonic minor",
  locrian: "Locrian",
  lydian: "Lydian",
  major: "Major",
  "major-pentatonic": "Major pentatonic",
  "melodic-minor": "Melodic minor",
  minor: "Minor",
  "minor-pentatonic": "Minor pentatonic",
  mixolydian: "Mixolydian",
  phrygian: "Phrygian",
};
const SCALE_NAMES = Object.keys(SCALES) as ScaleName[];
const ROOTS = Array.from({ length: 12 }, (_, root) => root);

/** "D Dorian": a scale's root and its name. */
export const scaleLabel = (scale: Scale) =>
  `${pitchClassName(scale.root)} ${SCALE_LABELS[scale.name]}`;

interface ScaleMenuContextValue {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onScaleChange: (scale: Scale) => void;
  scale: Scale;
}

const ScaleMenuContext = createContext<ScaleMenuContextValue | null>(null);

function useScaleMenu() {
  const context = use(ScaleMenuContext);
  if (!context) {
    throw new Error("ScaleMenu parts must be placed inside a ScaleMenu.");
  }
  return context;
}

interface ScaleMenuProps {
  children: ReactNode;
  /** Whether the scale is in use, such as marked on a roll's rows. */
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  /** Picking a root or a scale also turns it on. */
  onScaleChange: (scale: Scale) => void;
  /** The root and the scale, kept while the scale is off. */
  scale: Scale;
}

/** A menu that picks a root and a scale, and turns the scale on or off. */
function ScaleMenu({
  children,
  enabled,
  onEnabledChange,
  onScaleChange,
  scale,
}: ScaleMenuProps) {
  const value = useMemo(
    () => ({ enabled, onEnabledChange, onScaleChange, scale }),
    [enabled, onEnabledChange, onScaleChange, scale]
  );
  return (
    <ScaleMenuContext value={value}>
      <DropdownMenu>{children}</DropdownMenu>
    </ScaleMenuContext>
  );
}

/** The button that opens the menu: filled and named after the scale when it is on, "Scale" when off. */
function ScaleMenuTrigger(
  props: Omit<ComponentProps<typeof Button>, "children" | "variant">
) {
  const { enabled, scale } = useScaleMenu();
  return (
    <DropdownMenuTrigger
      render={
        <Button
          aria-label={`Scale: ${enabled ? scaleLabel(scale) : "off"}`}
          data-slot="scale-menu-trigger"
          variant={enabled ? "default" : "outline"}
          {...props}
        />
      }
    >
      {enabled ? scaleLabel(scale) : "Scale"}
    </DropdownMenuTrigger>
  );
}

function ScaleMenuContent({
  align = "end",
  className,
  ...props
}: ComponentProps<typeof DropdownMenuContent>) {
  return (
    <DropdownMenuContent
      align={align}
      className={cn("w-auto min-w-48", className)}
      data-slot="scale-menu-content"
      {...props}
    />
  );
}

/** A checkbox item that turns the scale on or off. Its children are the label. */
function ScaleMenuToggle({
  children = "Mark the scale",
  ...props
}: Omit<
  ComponentProps<typeof DropdownMenuCheckboxItem>,
  "checked" | "onCheckedChange"
>) {
  const { enabled, onEnabledChange } = useScaleMenu();
  return (
    <DropdownMenuCheckboxItem
      checked={enabled}
      data-slot="scale-menu-toggle"
      onCheckedChange={onEnabledChange}
      {...props}
    >
      {children}
    </DropdownMenuCheckboxItem>
  );
}

/** A submenu of the twelve roots. */
function ScaleMenuRoot() {
  const { onEnabledChange, onScaleChange, scale } = useScaleMenu();
  const changeRoot = useCallback(
    (root: number) => {
      onScaleChange({ ...scale, root });
      onEnabledChange(true);
    },
    [onEnabledChange, onScaleChange, scale]
  );
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger data-slot="scale-menu-root">
        Root: {pitchClassName(scale.root)}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuRadioGroup onValueChange={changeRoot} value={scale.root}>
          {ROOTS.map((root) => (
            <DropdownMenuRadioItem key={root} value={root}>
              {pitchClassName(root)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

/** A submenu of the scales, by name. */
function ScaleMenuName() {
  const { onEnabledChange, onScaleChange, scale } = useScaleMenu();
  const changeName = useCallback(
    (name: ScaleName) => {
      onScaleChange({ ...scale, name });
      onEnabledChange(true);
    },
    [onEnabledChange, onScaleChange, scale]
  );
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger data-slot="scale-menu-name">
        Scale: {SCALE_LABELS[scale.name]}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuRadioGroup onValueChange={changeName} value={scale.name}>
          {SCALE_NAMES.map((name) => (
            <DropdownMenuRadioItem key={name} value={name}>
              {SCALE_LABELS[name]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

export {
  ScaleMenu,
  ScaleMenuContent,
  ScaleMenuName,
  ScaleMenuRoot,
  ScaleMenuToggle,
  ScaleMenuTrigger,
};
