"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { CaretRightIcon, CheckIcon } from "@phosphor-icons/react";
import { cn } from "@/registry/bases/base/lib/utils";

function Picker({ ...props }: MenuPrimitive.Root.Props) {
  return <MenuPrimitive.Root data-slot="picker" {...props} />;
}

function PickerPortal({ ...props }: MenuPrimitive.Portal.Props) {
  return <MenuPrimitive.Portal data-slot="picker-portal" {...props} />;
}

function PickerTrigger({ className, ...props }: MenuPrimitive.Trigger.Props) {
  return (
    <MenuPrimitive.Trigger
      className={cn(
        "relative flex w-36 shrink-0 items-center justify-between gap-2",
        "touch-manipulation select-none rounded-xl p-3 text-left",
        "ring-1 ring-foreground/10",
        "hover:bg-muted focus-visible:outline-none focus-visible:ring-foreground/50",
        "disabled:opacity-50",
        "data-popup-open:bg-muted",
        "md:w-full md:rounded-lg md:px-2.5 md:py-2",
        className
      )}
      data-slot="picker-trigger"
      {...props}
    />
  );
}

function PickerContent({
  align = "start",
  alignOffset = 0,
  side = "right",
  sideOffset = 20,
  anchor,
  className,
  ...props
}: MenuPrimitive.Popup.Props &
  Pick<
    MenuPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset" | "anchor"
  >) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        anchor={anchor}
        className="isolate z-50 outline-none"
        side={side}
        sideOffset={sideOffset}
      >
        <MenuPrimitive.Popup
          className={cn(
            "no-scrollbar z-50 max-h-(--available-height)",
            "w-[calc(var(--available-width)-(--spacing(6)))] min-w-32 md:w-48",
            "origin-(--transform-origin) translate-y-2",
            "overflow-y-auto overflow-x-hidden rounded-xl p-1.5 outline-none",
            "border-0 bg-neutral-950/80 text-neutral-100",
            "ring-1 ring-neutral-950/80 backdrop-blur-xl",
            "data-closed:overflow-hidden",
            className
          )}
          data-slot="picker-content"
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

function PickerGroup({ ...props }: MenuPrimitive.Group.Props) {
  return <MenuPrimitive.Group data-slot="picker-group" {...props} />;
}

function PickerLabel({
  className,
  inset,
  ...props
}: MenuPrimitive.GroupLabel.Props & { inset?: boolean }) {
  return (
    <MenuPrimitive.GroupLabel
      className={cn(
        "px-2 py-1.5 font-medium text-neutral-400 text-xs",
        "data-inset:pl-8",
        className
      )}
      data-inset={inset}
      data-slot="picker-label"
      {...props}
    />
  );
}

function PickerItem({
  className,
  inset,
  ...props
}: MenuPrimitive.Item.Props & { inset?: boolean }) {
  return (
    <MenuPrimitive.Item
      className={cn(
        "group/picker-item relative flex cursor-default select-none items-center gap-2",
        "rounded-lg px-2 py-1.5 font-medium text-sm outline-none",
        "**:text-neutral-100 focus:bg-neutral-600 focus:text-neutral-100",
        "data-inset:pl-8",
        "dark:focus:bg-neutral-700/80",
        "pointer-coarse:gap-3 pointer-coarse:py-2.5 pointer-coarse:pl-3 pointer-coarse:text-base",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        "[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      data-inset={inset}
      data-slot="picker-item"
      {...props}
    />
  );
}

function PickerRadioGroup({ ...props }: MenuPrimitive.RadioGroup.Props) {
  return <MenuPrimitive.RadioGroup data-slot="picker-radio-group" {...props} />;
}

function PickerRadioItem({
  className,
  children,
  ...props
}: MenuPrimitive.RadioItem.Props) {
  return (
    <MenuPrimitive.RadioItem
      className={cn(
        "relative flex cursor-default select-none items-center gap-2",
        "rounded-lg py-1.5 pr-8 pl-2 font-medium text-sm outline-none",
        "**:text-neutral-100 focus:bg-neutral-600 focus:text-neutral-100",
        "dark:focus:bg-neutral-700/80",
        "pointer-coarse:gap-3 pointer-coarse:py-2.5 pointer-coarse:pl-3 pointer-coarse:text-base",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        "[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      data-slot="picker-radio-item"
      {...props}
    >
      {children}
      <span className="pointer-events-none absolute right-2 flex items-center justify-center">
        <MenuPrimitive.RadioItemIndicator>
          <CheckIcon
            aria-hidden="true"
            className="pointer-coarse:size-4 size-3.5"
          />
        </MenuPrimitive.RadioItemIndicator>
      </span>
    </MenuPrimitive.RadioItem>
  );
}

function PickerSub({ ...props }: MenuPrimitive.SubmenuRoot.Props) {
  return <MenuPrimitive.SubmenuRoot data-slot="picker-sub" {...props} />;
}

function PickerSubTrigger({
  className,
  inset,
  children,
  ...props
}: MenuPrimitive.SubmenuTrigger.Props & { inset?: boolean }) {
  return (
    <MenuPrimitive.SubmenuTrigger
      className={cn(
        "flex cursor-default select-none items-center gap-2 rounded-lg px-2 py-1.5",
        "font-medium text-sm outline-none",
        "**:text-neutral-100 focus:bg-neutral-600",
        "data-open:bg-neutral-600 data-inset:pl-8",
        "[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      data-inset={inset}
      data-slot="picker-sub-trigger"
      {...props}
    >
      {children}
      <CaretRightIcon aria-hidden="true" className="ml-auto size-4" />
    </MenuPrimitive.SubmenuTrigger>
  );
}

function PickerSeparator({
  className,
  ...props
}: MenuPrimitive.Separator.Props) {
  return (
    <MenuPrimitive.Separator
      className={cn(
        "-mx-1.5 my-1.5 h-px bg-neutral-600 dark:bg-neutral-700",
        className
      )}
      data-slot="picker-separator"
      {...props}
    />
  );
}

function PickerShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "ml-auto text-neutral-400! text-xs tracking-widest group-focus/picker-item:text-neutral-100",
        className
      )}
      data-slot="picker-shortcut"
      {...props}
    />
  );
}

function Swatch({ color, className }: { color?: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "size-4 shrink-0 rounded-full ring-1 ring-white/20",
        className
      )}
      style={{ backgroundColor: color }}
    />
  );
}

export {
  Picker,
  PickerPortal,
  PickerTrigger,
  PickerContent,
  PickerGroup,
  PickerLabel,
  PickerItem,
  PickerRadioGroup,
  PickerRadioItem,
  PickerSeparator,
  PickerShortcut,
  PickerSub,
  PickerSubTrigger,
  Swatch,
};
