import {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuItemIndicator,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
} from "@ui-sdk/react/menu";
import { type ComponentProps, type ReactNode, useCallback, useId } from "react";
import { IconPlaceholder } from "@/components/icon-placeholder";
import { usePopupContainer } from "@/hooks/use-popup-container";
import { cn } from "@/lib/utils";

function DropdownMenu({ container, ...props }: ComponentProps<typeof Menu>) {
  const popups = usePopupContainer();
  return <Menu container={container ?? popups} {...props} />;
}

const DropdownMenuTrigger = MenuTrigger;

function DropdownMenuContent({
  align = "start",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 4,
  className,
  finalFocus,
  ...props
}: Omit<ComponentProps<typeof MenuContent>, "finalFocus"> & {
  // The shadcn API takes `false` for "leave focus where it is", ui-sdk `"none"`.
  finalFocus?: ComponentProps<typeof MenuContent>["finalFocus"] | boolean;
}) {
  return (
    <MenuContent
      align={align}
      alignOffset={alignOffset}
      className={cn(
        "data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 ring-foreground/10 bg-popover text-popover-foreground min-w-32 rounded-lg p-1 shadow-md ring-1 duration-100 data-[side=inline-start]:slide-in-from-right-2 data-[side=inline-end]:slide-in-from-left-2 animate-none! relative bg-popover/70 before:pointer-events-none before:absolute before:inset-0 before:-z-1 before:rounded-[inherit] before:backdrop-blur-2xl before:backdrop-saturate-150 **:data-[slot$=-item]:focus:bg-foreground/10 **:data-[slot$=-item]:data-highlighted:bg-foreground/10 **:data-[slot$=-item]:focus:text-foreground **:data-[slot$=-item]:data-highlighted:text-foreground **:data-[slot$=-separator]:bg-foreground/5 **:data-[slot$=-trigger]:focus:bg-foreground/10 **:data-[slot$=-trigger]:focus:text-foreground **:data-[slot$=-trigger]:aria-expanded:text-foreground **:data-[slot$=-trigger]:aria-expanded:bg-foreground/10! **:data-[variant=destructive]:focus:bg-foreground/10! **:data-[variant=destructive]:text-accent-foreground! **:data-[variant=destructive]:**:text-accent-foreground! z-50 max-h-(--available-height) origin-(--transform-origin) overflow-x-hidden overflow-y-auto outline-none data-closed:overflow-hidden w-(--anchor-width)",
        className
      )}
      finalFocus={
        finalFocus === false
          ? "none"
          : (finalFocus as ComponentProps<typeof MenuContent>["finalFocus"])
      }
      side={side}
      sideOffset={sideOffset}
      {...props}
    />
  );
}

const DropdownMenuGroup = MenuGroup;

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: ComponentProps<typeof MenuGroupLabel> & {
  inset?: boolean;
}) {
  return (
    <MenuGroupLabel
      className={cn(
        "text-muted-foreground px-1.5 py-1 text-xs font-medium data-inset:pl-7",
        className
      )}
      data-inset={inset}
      {...props}
    />
  );
}

function DropdownMenuItem({
  className,
  closeOnClick,
  inset,
  variant = "default",
  ...props
}: ComponentProps<typeof MenuItem> & {
  // The shadcn name for `closeOnSelect`.
  closeOnClick?: boolean;
  inset?: boolean;
  variant?: "default" | "destructive";
}) {
  return (
    <MenuItem
      className={cn(
        "focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:*:[svg]:text-destructive not-data-[variant=destructive]:focus:**:text-accent-foreground gap-1.5 rounded-md px-1.5 py-1 text-sm data-inset:pl-7 [&_svg:not([class*='size-'])]:size-4 group/dropdown-menu-item relative flex cursor-default items-center outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      closeOnSelect={closeOnClick}
      data-inset={inset}
      data-variant={variant}
      {...props}
    />
  );
}

const DropdownMenuSub = MenuSub;

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: Omit<ComponentProps<typeof MenuSubTrigger>, "children"> & {
  children?: ReactNode;
  inset?: boolean;
}) {
  return (
    <MenuSubTrigger
      className={cn(
        "focus:bg-accent focus:text-accent-foreground data-open:bg-accent data-open:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground gap-1.5 rounded-md px-1.5 py-1 text-sm data-inset:pl-7 [&_svg:not([class*='size-'])]:size-4 flex cursor-default items-center outline-hidden select-none [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      data-inset={inset}
      {...props}
    >
      {children}
      <IconPlaceholder
        className="ms-auto rtl:rotate-180"
        hugeicons="ArrowRight01Icon"
        lucide="ChevronRightIcon"
        phosphor="CaretRightIcon"
        remixicon="RiArrowRightSLine"
        tabler="IconChevronRight"
      />
    </MenuSubTrigger>
  );
}

function DropdownMenuSubContent({
  align = "start",
  alignOffset = -3,
  side = "right",
  sideOffset = 0,
  className,
  ...props
}: ComponentProps<typeof MenuSubContent>) {
  return (
    <MenuSubContent
      align={align}
      alignOffset={alignOffset}
      className={cn(
        "data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 ring-foreground/10 bg-popover text-popover-foreground min-w-[96px] rounded-lg p-1 shadow-lg ring-1 duration-100 animate-none! relative bg-popover/70 before:pointer-events-none before:absolute before:inset-0 before:-z-1 before:rounded-[inherit] before:backdrop-blur-2xl before:backdrop-saturate-150 **:data-[slot$=-item]:focus:bg-foreground/10 **:data-[slot$=-item]:data-highlighted:bg-foreground/10 **:data-[slot$=-item]:focus:text-foreground **:data-[slot$=-item]:data-highlighted:text-foreground **:data-[slot$=-separator]:bg-foreground/5 **:data-[slot$=-trigger]:focus:bg-foreground/10 **:data-[slot$=-trigger]:focus:text-foreground **:data-[slot$=-trigger]:aria-expanded:text-foreground **:data-[slot$=-trigger]:aria-expanded:bg-foreground/10! **:data-[variant=destructive]:focus:bg-foreground/10! **:data-[variant=destructive]:text-accent-foreground! **:data-[variant=destructive]:**:text-accent-foreground! z-50 w-auto origin-(--transform-origin) overflow-x-hidden overflow-y-auto outline-none",
        className
      )}
      side={side}
      sideOffset={sideOffset}
      {...props}
    />
  );
}

function DropdownMenuCheckboxItem({
  className,
  children,
  closeOnClick,
  inset,
  value,
  ...props
}: Omit<ComponentProps<typeof MenuCheckboxItem>, "children" | "value"> & {
  children?: ReactNode;
  closeOnClick?: boolean;
  inset?: boolean;
  value?: string;
}) {
  const id = useId();
  return (
    <MenuCheckboxItem
      className={cn(
        "focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm data-inset:pl-7 [&_svg:not([class*='size-'])]:size-4 relative flex cursor-default items-center outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      closeOnSelect={closeOnClick}
      data-inset={inset}
      value={value ?? id}
      {...props}
    >
      <MenuItemIndicator className="absolute right-2 flex items-center justify-center pointer-events-none">
        <IconPlaceholder
          hugeicons="Tick02Icon"
          lucide="CheckIcon"
          phosphor="CheckIcon"
          remixicon="RiCheckLine"
          tabler="IconCheck"
        />
      </MenuItemIndicator>
      {children}
    </MenuCheckboxItem>
  );
}

// Radio values may be numbers in the shadcn API, ui-sdk's are strings: the group and its items convert.
function DropdownMenuRadioGroup<T extends string | number>({
  defaultValue,
  onValueChange,
  value,
  ...props
}: Omit<
  ComponentProps<typeof MenuRadioGroup>,
  "defaultValue" | "onValueChange" | "value"
> & {
  defaultValue?: T | null;
  onValueChange?: (value: T, details: unknown) => void;
  value?: T | null;
}) {
  const asText = (each: T | null | undefined) =>
    each === null || each === undefined ? each : String(each);
  const numeric = typeof (value ?? defaultValue) === "number";
  const change = useCallback(
    (next: string, details: unknown) =>
      onValueChange?.((numeric ? Number(next) : next) as T, details),
    [numeric, onValueChange]
  );
  return (
    <MenuRadioGroup
      defaultValue={asText(defaultValue)}
      onValueChange={change}
      value={asText(value)}
      {...props}
    />
  );
}

function DropdownMenuRadioItem({
  className,
  children,
  closeOnClick,
  inset,
  value,
  ...props
}: Omit<ComponentProps<typeof MenuRadioItem>, "children" | "value"> & {
  children?: ReactNode;
  closeOnClick?: boolean;
  value: string | number;
  inset?: boolean;
}) {
  return (
    <MenuRadioItem
      className={cn(
        "focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm data-inset:pl-7 [&_svg:not([class*='size-'])]:size-4 relative flex cursor-default items-center outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      closeOnSelect={closeOnClick}
      data-inset={inset}
      value={String(value)}
      {...props}
    >
      <MenuItemIndicator className="absolute right-2 flex items-center justify-center pointer-events-none">
        <IconPlaceholder
          hugeicons="Tick02Icon"
          lucide="CheckIcon"
          phosphor="CheckIcon"
          remixicon="RiCheckLine"
          tabler="IconCheck"
        />
      </MenuItemIndicator>
      {children}
    </MenuRadioItem>
  );
}

function DropdownMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof MenuSeparator>) {
  return (
    <MenuSeparator
      className={cn("bg-border -mx-1 my-1 h-px", className)}
      {...props}
    />
  );
}

function DropdownMenuShortcut({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "text-muted-foreground group-focus/dropdown-menu-item:text-accent-foreground ml-auto text-xs tracking-widest",
        className
      )}
      data-slot="dropdown-menu-shortcut"
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
};
