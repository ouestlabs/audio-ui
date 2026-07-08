"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import type * as React from "react";
import { IconPlaceholder } from "@/app/(create)/components/icon-placeholder";
import { cn } from "@/registry/bases/base/lib/utils";

function Picker({ ...props }: MenuPrimitive.Root.Props) {
  return <MenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

function PickerPortal({ ...props }: MenuPrimitive.Portal.Props) {
  return <MenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />;
}

function PickerTrigger({ className, ...props }: MenuPrimitive.Trigger.Props) {
  return (
    <MenuPrimitive.Trigger
      className={cn(
        "site-rounded-xl md:site-rounded-lg in-data-[slot=sheet-content]:site-rounded-lg relative w-[160px] shrink-0 touch-manipulation select-none border border-site-foreground/10 bg-site-muted/50 p-2 font-site-sans hover:bg-site-muted disabled:opacity-50 data-popup-open:bg-site-muted md:w-full in-data-[slot=sheet-content]:w-full md:border-transparent in-data-[slot=sheet-content]:border-transparent md:bg-transparent in-data-[slot=sheet-content]:bg-transparent",
        className
      )}
      data-slot="dropdown-menu-trigger"
      {...props}
    />
  );
}

function PickerContent({
  align = "start",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 4,
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
        collisionAvoidance={{ fallbackAxisSide: "end" }}
        side={side}
        sideOffset={sideOffset}
      >
        <MenuPrimitive.Popup
          className={cn(
            "data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 cn-menu-target no-scrollbar site-rounded-xl z-50 max-h-(--available-height) w-[calc(var(--anchor-width)-(--spacing(3.5)))] min-w-32 origin-(--transform-origin) overflow-y-auto overflow-x-hidden border-0 bg-site-popover p-1 font-site-sans text-site-popover-foreground shadow-md outline-none ring-1 ring-site-foreground/10 duration-100 data-closed:animate-out data-open:animate-in data-closed:overflow-hidden md:w-52",
            className
          )}
          data-slot="dropdown-menu-content"
          {...props}
        />
      </MenuPrimitive.Positioner>
      <div className="absolute inset-0 z-40 bg-transparent" />
    </MenuPrimitive.Portal>
  );
}

function PickerGroup({ ...props }: MenuPrimitive.Group.Props) {
  return <MenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />;
}

function PickerLabel({
  className,
  inset,
  ...props
}: MenuPrimitive.GroupLabel.Props & {
  inset?: boolean;
}) {
  return (
    <MenuPrimitive.GroupLabel
      className={cn(
        "px-2 py-1.5 font-medium text-site-muted-foreground text-xs data-inset:pl-8",
        className
      )}
      data-inset={inset}
      data-slot="dropdown-menu-label"
      {...props}
    />
  );
}

function PickerItem({
  className,
  inset,
  variant = "default",
  ...props
}: MenuPrimitive.Item.Props & {
  inset?: boolean;
  variant?: "default" | "destructive";
}) {
  return (
    <MenuPrimitive.Item
      className={cn(
        "group/dropdown-menu-item site-rounded-sm relative flex cursor-default select-none items-center gap-2 px-2 pointer-coarse:py-2.5 py-1.5 pointer-coarse:pl-3 pointer-coarse:text-base text-sm outline-hidden focus:bg-site-accent focus:text-site-accent-foreground not-data-[variant=destructive]:focus:**:text-site-accent-foreground data-disabled:pointer-events-none data-inset:pl-8 data-[variant=destructive]:text-site-destructive data-disabled:opacity-50 data-[variant=destructive]:focus:bg-site-destructive/10 data-[variant=destructive]:focus:text-site-destructive dark:data-[variant=destructive]:focus:bg-site-destructive/20 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0 data-[variant=destructive]:*:[svg]:text-site-destructive",
        className
      )}
      data-inset={inset}
      data-slot="dropdown-menu-item"
      data-variant={variant}
      {...props}
    />
  );
}

function PickerSub({ ...props }: MenuPrimitive.SubmenuRoot.Props) {
  return <MenuPrimitive.SubmenuRoot data-slot="dropdown-menu-sub" {...props} />;
}

function PickerSubTrigger({
  className,
  inset,
  children,
  ...props
}: MenuPrimitive.SubmenuTrigger.Props & {
  inset?: boolean;
}) {
  return (
    <MenuPrimitive.SubmenuTrigger
      className={cn(
        "site-rounded-sm flex cursor-default select-none items-center gap-2 px-2 py-1.5 text-sm outline-hidden focus:bg-site-accent focus:text-site-accent-foreground not-data-[variant=destructive]:focus:**:text-site-accent-foreground data-open:bg-site-accent data-inset:pl-8 data-open:text-site-accent-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      data-inset={inset}
      data-slot="dropdown-menu-sub-trigger"
      {...props}
    >
      {children}
      <IconPlaceholder
        className="ml-auto"
        hugeicons="ArrowRight01Icon"
        lucide="ChevronRightIcon"
        phosphor="CaretRightIcon"
        remixicon="RiArrowRightSLine"
        tabler="IconChevronRight"
      />
    </MenuPrimitive.SubmenuTrigger>
  );
}

function PickerSubContent({
  align = "start",
  alignOffset = -3,
  side = "right",
  sideOffset = 0,
  className,
  ...props
}: React.ComponentProps<typeof PickerContent>) {
  return (
    <PickerContent
      align={align}
      alignOffset={alignOffset}
      className={cn(
        "data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 site-rounded-md w-auto min-w-[96px] bg-site-popover p-1 font-site-sans text-site-popover-foreground shadow-lg ring-1 ring-site-foreground/10 duration-100 data-closed:animate-out data-open:animate-in",
        className
      )}
      data-slot="dropdown-menu-sub-content"
      side={side}
      sideOffset={sideOffset}
      {...props}
    />
  );
}

function PickerCheckboxItem({
  className,
  children,
  checked,
  ...props
}: MenuPrimitive.CheckboxItem.Props) {
  return (
    <MenuPrimitive.CheckboxItem
      checked={checked}
      className={cn(
        "site-rounded-sm relative flex cursor-default select-none items-center gap-2 py-1.5 pr-8 pl-2 text-sm outline-hidden focus:bg-site-accent focus:text-site-accent-foreground focus:**:text-site-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      data-slot="dropdown-menu-checkbox-item"
      {...props}
    >
      <span className="pointer-events-none absolute right-2 flex items-center justify-center">
        <MenuPrimitive.CheckboxItemIndicator>
          <IconPlaceholder
            hugeicons="Tick02Icon"
            lucide="CheckIcon"
            phosphor="CheckIcon"
            remixicon="RiCheckLine"
            tabler="IconCheck"
          />
        </MenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </MenuPrimitive.CheckboxItem>
  );
}

function PickerRadioGroup({ ...props }: MenuPrimitive.RadioGroup.Props) {
  return (
    <MenuPrimitive.RadioGroup
      data-slot="dropdown-menu-radio-group"
      {...props}
    />
  );
}

function PickerRadioItem({
  className,
  children,
  ...props
}: MenuPrimitive.RadioItem.Props) {
  return (
    <MenuPrimitive.RadioItem
      className={cn(
        "site-rounded-lg relative flex cursor-default select-none items-center gap-2 pointer-coarse:gap-3 pointer-coarse:py-2.5 py-1.5 pr-8 pl-2 pointer-coarse:pl-3 pointer-coarse:text-base text-sm outline-hidden focus:bg-site-accent focus:text-site-accent-foreground focus:**:text-site-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      data-slot="dropdown-menu-radio-item"
      {...props}
    >
      <span
        className="pointer-events-none absolute right-2 flex items-center justify-center"
        data-slot="dropdown-menu-radio-item-indicator"
      >
        <MenuPrimitive.RadioItemIndicator>
          <IconPlaceholder
            className="pointer-coarse:size-5 size-4"
            hugeicons="Tick02Icon"
            lucide="CheckIcon"
            phosphor="CheckIcon"
            remixicon="RiCheckLine"
            tabler="IconCheck"
          />
        </MenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </MenuPrimitive.RadioItem>
  );
}

function PickerSeparator({
  className,
  ...props
}: MenuPrimitive.Separator.Props) {
  return (
    <MenuPrimitive.Separator
      className={cn("-mx-1 my-1 h-px bg-site-border", className)}
      data-slot="dropdown-menu-separator"
      {...props}
    />
  );
}

function PickerShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "ml-auto text-site-muted-foreground text-xs tracking-widest group-focus/dropdown-menu-item:text-site-accent-foreground",
        className
      )}
      data-slot="dropdown-menu-shortcut"
      {...props}
    />
  );
}

export {
  Picker,
  PickerCheckboxItem,
  PickerContent,
  PickerGroup,
  PickerItem,
  PickerLabel,
  PickerPortal,
  PickerRadioGroup,
  PickerRadioItem,
  PickerSeparator,
  PickerShortcut,
  PickerSub,
  PickerSubContent,
  PickerSubTrigger,
  PickerTrigger,
};
