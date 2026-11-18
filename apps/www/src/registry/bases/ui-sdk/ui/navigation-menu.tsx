import {
  NavigationMenuContent as NavigationMenuContentPrimitive,
  NavigationMenuIndicator as NavigationMenuIndicatorPrimitive,
  NavigationMenuItem as NavigationMenuItemPrimitive,
  NavigationMenuLink as NavigationMenuLinkPrimitive,
  NavigationMenuList as NavigationMenuListPrimitive,
  NavigationMenu as NavigationMenuPrimitive,
  NavigationMenuTrigger as NavigationMenuTriggerPrimitive,
  NavigationMenuViewport as NavigationMenuViewportPrimitive,
} from "@ui-sdk/react/navigation-menu";
import { cva } from "class-variance-authority";
import type { ComponentProps, ReactNode } from "react";
import { IconPlaceholder } from "@/components/icon-placeholder";
import { cn } from "@/lib/utils";
import { usePopupContainer } from "@/registry/bases/ui-sdk/hooks/use-popup-container";

// Without a viewport, each panel opens on its own beside its trigger.
function NavigationMenu({
  className,
  children,
  container,
  viewport = true,
  ...props
}: Omit<ComponentProps<typeof NavigationMenuPrimitive>, "children"> & {
  children?: ReactNode;
  viewport?: boolean;
}) {
  const popups = usePopupContainer();
  return (
    <NavigationMenuPrimitive
      className={cn(
        "cn-navigation-menu group/navigation-menu relative flex max-w-max flex-1 items-center justify-center",
        className
      )}
      container={container ?? popups}
      data-viewport={viewport}
      {...props}
    >
      {children}
      {viewport ? <NavigationMenuViewport /> : null}
    </NavigationMenuPrimitive>
  );
}

function NavigationMenuList({
  className,
  ...props
}: ComponentProps<typeof NavigationMenuListPrimitive>) {
  return (
    <NavigationMenuListPrimitive
      className={cn(
        "cn-navigation-menu-list group flex flex-1 list-none items-center justify-center",
        className
      )}
      {...props}
    />
  );
}

function NavigationMenuItem({
  className,
  ...props
}: ComponentProps<typeof NavigationMenuItemPrimitive>) {
  return (
    <NavigationMenuItemPrimitive
      className={cn("relative", className)}
      {...props}
    />
  );
}

const navigationMenuTriggerStyle = cva(
  "cn-navigation-menu-trigger group/navigation-menu-trigger inline-flex h-9 w-max items-center justify-center outline-none disabled:pointer-events-none"
);

function NavigationMenuTrigger({
  className,
  children,
  ...props
}: Omit<ComponentProps<typeof NavigationMenuTriggerPrimitive>, "children"> & {
  children?: ReactNode;
}) {
  return (
    <NavigationMenuTriggerPrimitive
      className={cn(navigationMenuTriggerStyle(), className)}
      {...props}
    >
      {children}{" "}
      <IconPlaceholder
        aria-hidden="true"
        className="cn-navigation-menu-trigger-icon"
        hugeicons="ArrowDown01Icon"
        lucide="ChevronDownIcon"
        phosphor="CaretDownIcon"
        remixicon="RiArrowDownSLine"
        tabler="IconChevronDown"
      />
    </NavigationMenuTriggerPrimitive>
  );
}

// In the viewport a panel sits at its corner with its own width, and the viewport takes that size.
function NavigationMenuContent({
  className,
  ...props
}: ComponentProps<typeof NavigationMenuContentPrimitive>) {
  return (
    <NavigationMenuContentPrimitive
      className={cn(
        "cn-navigation-menu-content w-max outline-none in-data-[slot=navigation-menu-viewport]:absolute in-data-[slot=navigation-menu-viewport]:inset-s-0 in-data-[slot=navigation-menu-viewport]:top-0 **:data-[slot=navigation-menu-link]:focus:ring-0 **:data-[slot=navigation-menu-link]:focus:outline-none",
        className
      )}
      {...props}
    />
  );
}

function NavigationMenuViewport({
  className,
  sideOffset = 8,
  ...props
}: ComponentProps<typeof NavigationMenuViewportPrimitive>) {
  return (
    <NavigationMenuViewportPrimitive
      className={cn(
        "cn-navigation-menu-popup z-50 h-(--viewport-height) w-(--viewport-width) origin-(--transform-origin) overflow-hidden transition-[opacity,scale,width,height,left,top] duration-300",
        className
      )}
      sideOffset={sideOffset}
      {...props}
    />
  );
}

// `active` is the shadcn API's name for the current page.
function NavigationMenuLink({
  active,
  className,
  current,
  ...props
}: ComponentProps<typeof NavigationMenuLinkPrimitive> & { active?: boolean }) {
  return (
    <NavigationMenuLinkPrimitive
      className={cn(
        "cn-navigation-menu-link data-current:bg-muted/50 data-current:hover:bg-muted data-current:focus:bg-muted",
        className
      )}
      current={current ?? active}
      {...props}
    />
  );
}

function NavigationMenuIndicator({
  className,
  ...props
}: Omit<ComponentProps<typeof NavigationMenuIndicatorPrimitive>, "children">) {
  return (
    <NavigationMenuIndicatorPrimitive
      className={cn(
        "cn-navigation-menu-indicator absolute top-full left-(--active-item-left) z-1 flex h-1.5 w-(--active-item-width) items-end justify-center overflow-hidden transition-[left,width,opacity] duration-300 not-data-open:opacity-0",
        className
      )}
      {...props}
    >
      <div className="cn-navigation-menu-indicator-arrow relative top-[60%] size-2 rotate-45" />
    </NavigationMenuIndicatorPrimitive>
  );
}

export {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuIndicator,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuViewport,
  navigationMenuTriggerStyle,
};
