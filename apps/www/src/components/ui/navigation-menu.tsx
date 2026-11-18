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
import { usePopupContainer } from "@/hooks/use-popup-container";
import { cn } from "@/lib/utils";

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
        "max-w-max group/navigation-menu relative flex flex-1 items-center justify-center",
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
        "gap-0 group flex flex-1 list-none items-center justify-center",
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
  "hover:bg-muted focus:bg-muted data-open:hover:bg-muted data-open:focus:bg-muted data-open:bg-muted/50 focus-visible:ring-ring/50 data-open:bg-muted/50 data-open:hover:bg-muted rounded-lg px-2.5 py-1.5 text-sm font-medium transition-all focus-visible:ring-3 focus-visible:outline-1 disabled:opacity-50 group/navigation-menu-trigger inline-flex h-9 w-max items-center justify-center outline-none disabled:pointer-events-none"
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
        className="relative top-px ml-1 size-3 transition duration-300 group-data-open/navigation-menu-trigger:rotate-180"
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
        "data-[motion^=from-]:animate-in data-[motion^=to-]:animate-out data-[motion^=from-]:fade-in data-[motion^=to-]:fade-out data-[motion=from-end]:slide-in-from-right-52 data-[motion=from-start]:slide-in-from-left-52 data-[motion=to-end]:slide-out-to-right-52 data-[motion=to-start]:slide-out-to-left-52 group-data-[viewport=false]/navigation-menu:bg-popover group-data-[viewport=false]/navigation-menu:text-popover-foreground group-data-[viewport=false]/navigation-menu:data-open:animate-in group-data-[viewport=false]/navigation-menu:data-closed:animate-out group-data-[viewport=false]/navigation-menu:data-closed:zoom-out-95 group-data-[viewport=false]/navigation-menu:data-open:zoom-in-95 group-data-[viewport=false]/navigation-menu:data-open:fade-in-0 group-data-[viewport=false]/navigation-menu:data-closed:fade-out-0 group-data-[viewport=false]/navigation-menu:ring-foreground/10 p-1 ease-[cubic-bezier(0.22,1,0.36,1)] group-data-[viewport=false]/navigation-menu:rounded-lg group-data-[viewport=false]/navigation-menu:shadow group-data-[viewport=false]/navigation-menu:ring-1 group-data-[viewport=false]/navigation-menu:duration-300 w-max outline-none in-data-[slot=navigation-menu-viewport]:absolute in-data-[slot=navigation-menu-viewport]:inset-s-0 in-data-[slot=navigation-menu-viewport]:top-0 **:data-[slot=navigation-menu-link]:focus:ring-0 **:data-[slot=navigation-menu-link]:focus:outline-none",
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
        "bg-popover text-popover-foreground ring-foreground/10 rounded-lg shadow ring-1 transition-all ease-[cubic-bezier(0.22,1,0.36,1)] outline-none data-ending-style:scale-90 data-ending-style:opacity-0 data-ending-style:duration-150 data-starting-style:scale-90 data-starting-style:opacity-0 z-50 h-(--viewport-height) w-(--viewport-width) origin-(--transform-origin) overflow-hidden transition-[opacity,scale,width,height,left,top] duration-300",
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
        "data-selected:focus:bg-muted data-selected:hover:bg-muted data-selected:bg-muted/50 focus-visible:ring-ring/50 hover:bg-muted focus:bg-muted flex items-center gap-2 rounded-lg p-2 text-sm transition-all outline-none focus-visible:ring-3 focus-visible:outline-1 in-data-[slot=navigation-menu-content]:rounded-md [&_svg:not([class*='size-'])]:size-4 data-current:bg-muted/50 data-current:hover:bg-muted data-current:focus:bg-muted",
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
        "data-[state=visible]:animate-in data-[state=hidden]:animate-out data-[state=hidden]:fade-out data-[state=visible]:fade-in absolute top-full left-(--active-item-left) z-1 flex h-1.5 w-(--active-item-width) items-end justify-center overflow-hidden transition-[left,width,opacity] duration-300 not-data-open:opacity-0",
        className
      )}
      {...props}
    >
      <div className="bg-border rounded-tl-sm shadow-md relative top-[60%] size-2 rotate-45" />
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
