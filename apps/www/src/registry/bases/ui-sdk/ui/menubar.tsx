import {
  MenuCheckboxItem,
  MenuItemIndicator,
  MenuRadioItem,
} from "@ui-sdk/react/menu";
import { Menubar as MenubarPrimitive } from "@ui-sdk/react/menubar";
import { type ComponentProps, type ReactNode, useId } from "react";
import { IconPlaceholder } from "@/components/icon-placeholder";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/registry/bases/ui-sdk/ui/dropdown-menu";

function Menubar({
  className,
  ...props
}: ComponentProps<typeof MenubarPrimitive>) {
  return (
    <MenubarPrimitive
      className={cn("cn-menubar flex items-center", className)}
      {...props}
    />
  );
}

// Each menu joins the menubar around it: a menubar's menus are dropdown menus.
const MenubarMenu = DropdownMenu;
const MenubarGroup = DropdownMenuGroup;
const MenubarRadioGroup = DropdownMenuRadioGroup;
const MenubarSub = DropdownMenuSub;

function MenubarTrigger({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuTrigger>) {
  return (
    <DropdownMenuTrigger
      className={cn(
        "cn-menubar-trigger flex items-center outline-hidden select-none",
        className
      )}
      {...props}
    />
  );
}

function MenubarContent({
  className,
  align = "start",
  alignOffset = -4,
  sideOffset = 8,
  ...props
}: ComponentProps<typeof DropdownMenuContent>) {
  return (
    <DropdownMenuContent
      align={align}
      alignOffset={alignOffset}
      className={cn(
        "cn-menubar-content cn-menubar-content-logical cn-menu-translucent",
        className
      )}
      sideOffset={sideOffset}
      {...props}
    />
  );
}

function MenubarItem({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuItem>) {
  return (
    <DropdownMenuItem
      className={cn("cn-menubar-item group/menubar-item", className)}
      {...props}
    />
  );
}

function MenubarCheckboxItem({
  className,
  children,
  inset,
  value,
  ...props
}: Omit<ComponentProps<typeof MenuCheckboxItem>, "children" | "value"> & {
  children?: ReactNode;
  inset?: boolean;
  value?: string;
}) {
  const id = useId();
  return (
    <MenuCheckboxItem
      className={cn(
        "cn-menubar-checkbox-item relative flex cursor-default items-center outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      data-inset={inset}
      value={value ?? id}
      {...props}
    >
      <span className="cn-menubar-checkbox-item-indicator pointer-events-none absolute flex items-center justify-center">
        <MenuItemIndicator>
          <IconPlaceholder
            hugeicons="Tick02Icon"
            lucide="CheckIcon"
            phosphor="CheckIcon"
            remixicon="RiCheckLine"
            tabler="IconCheck"
          />
        </MenuItemIndicator>
      </span>
      {children}
    </MenuCheckboxItem>
  );
}

function MenubarRadioItem({
  className,
  children,
  inset,
  value,
  ...props
}: Omit<ComponentProps<typeof MenuRadioItem>, "children" | "value"> & {
  children?: ReactNode;
  inset?: boolean;
  value: string | number;
}) {
  return (
    <MenuRadioItem
      className={cn(
        "cn-menubar-radio-item relative flex cursor-default items-center outline-hidden select-none data-disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      data-inset={inset}
      value={String(value)}
      {...props}
    >
      <span className="cn-menubar-radio-item-indicator pointer-events-none absolute flex items-center justify-center">
        <MenuItemIndicator>
          <IconPlaceholder
            hugeicons="Tick02Icon"
            lucide="CheckIcon"
            phosphor="CheckIcon"
            remixicon="RiCheckLine"
            tabler="IconCheck"
          />
        </MenuItemIndicator>
      </span>
      {children}
    </MenuRadioItem>
  );
}

function MenubarLabel({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuLabel>) {
  return (
    <DropdownMenuLabel
      className={cn("cn-menubar-label", className)}
      {...props}
    />
  );
}

function MenubarSeparator({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuSeparator>) {
  return (
    <DropdownMenuSeparator
      className={cn("cn-menubar-separator -mx-1 my-1 h-px", className)}
      {...props}
    />
  );
}

function MenubarShortcut({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuShortcut>) {
  return (
    <DropdownMenuShortcut
      className={cn("cn-menubar-shortcut ml-auto", className)}
      {...props}
    />
  );
}

function MenubarSubTrigger({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuSubTrigger>) {
  return (
    <DropdownMenuSubTrigger
      className={cn("cn-menubar-sub-trigger", className)}
      {...props}
    />
  );
}

function MenubarSubContent({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuSubContent>) {
  return (
    <DropdownMenuSubContent
      className={cn("cn-menubar-sub-content cn-menu-translucent", className)}
      {...props}
    />
  );
}

export {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarLabel,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
};
