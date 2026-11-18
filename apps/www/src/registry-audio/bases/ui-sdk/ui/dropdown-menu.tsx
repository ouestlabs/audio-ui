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
import { cn } from "@/lib/utils";
import { usePopupContainer } from "@/registry-audio/bases/ui-sdk/hooks/use-popup-container";

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
        "cn-dropdown-menu-content cn-dropdown-menu-content-logical cn-menu-translucent z-50 max-h-(--available-height) origin-(--transform-origin) overflow-x-hidden overflow-y-auto outline-none data-closed:overflow-hidden w-(--anchor-width)",
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
      className={cn("cn-dropdown-menu-label", className)}
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
        "cn-dropdown-menu-item group/dropdown-menu-item relative flex cursor-default items-center outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
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
        "cn-dropdown-menu-sub-trigger flex cursor-default items-center outline-hidden select-none data-open:bg-accent data-open:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0",
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
        "cn-dropdown-menu-sub-content cn-menu-translucent z-50 w-auto origin-(--transform-origin) overflow-x-hidden overflow-y-auto outline-none",
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
        "cn-dropdown-menu-checkbox-item relative flex cursor-default items-center outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      closeOnSelect={closeOnClick}
      data-inset={inset}
      value={value ?? id}
      {...props}
    >
      <MenuItemIndicator className="cn-dropdown-menu-item-indicator pointer-events-none">
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
        "cn-dropdown-menu-radio-item relative flex cursor-default items-center outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      closeOnSelect={closeOnClick}
      data-inset={inset}
      value={String(value)}
      {...props}
    >
      <MenuItemIndicator className="cn-dropdown-menu-item-indicator pointer-events-none">
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
      className={cn("cn-dropdown-menu-separator", className)}
      {...props}
    />
  );
}

function DropdownMenuShortcut({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn("cn-dropdown-menu-shortcut", className)}
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
