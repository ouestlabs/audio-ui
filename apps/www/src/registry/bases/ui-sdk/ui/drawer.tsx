import {
  DrawerBackdrop,
  DrawerClose,
  DrawerContent as DrawerContentPrimitive,
  DrawerDescription as DrawerDescriptionPrimitive,
  Drawer as DrawerPrimitive,
  DrawerTitle as DrawerTitlePrimitive,
  DrawerTrigger,
} from "@ui-sdk/react/drawer";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";
import { usePopupContainer } from "@/registry/bases/ui-sdk/hooks/use-popup-container";

function Drawer({
  container,
  ...props
}: ComponentProps<typeof DrawerPrimitive>) {
  const popups = usePopupContainer();
  return <DrawerPrimitive container={container ?? popups} {...props} />;
}

function DrawerOverlay({
  className,
  ...props
}: ComponentProps<typeof DrawerBackdrop>) {
  return (
    <DrawerBackdrop
      className={cn("cn-drawer-overlay fixed inset-0 z-50", className)}
      {...props}
    />
  );
}

// The drawer places and slides the sheet itself: the content only sizes it, from the edge it opens at.
function DrawerContent({
  className,
  children,
  ...props
}: Omit<ComponentProps<typeof DrawerContentPrimitive>, "children"> & {
  children?: ReactNode;
}) {
  return (
    <>
      <DrawerOverlay />
      <DrawerContentPrimitive
        className={cn(
          "cn-drawer-content group/drawer-content z-50 outline-none data-[side=bottom]:max-h-[80vh] data-[side=bottom]:w-full data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=top]:max-h-[80vh] data-[side=top]:w-full data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm",
          className
        )}
        {...props}
      >
        <div
          aria-hidden="true"
          className="cn-drawer-handle group-data-[side=bottom]/drawer-content:block"
        />
        {children}
      </DrawerContentPrimitive>
    </>
  );
}

function DrawerHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "cn-drawer-header flex flex-col group-data-[side=bottom]/drawer-content:text-center group-data-[side=top]/drawer-content:text-center",
        className
      )}
      data-slot="drawer-header"
      {...props}
    />
  );
}

function DrawerFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("cn-drawer-footer mt-auto flex flex-col", className)}
      data-slot="drawer-footer"
      {...props}
    />
  );
}

function DrawerTitle({
  className,
  ...props
}: ComponentProps<typeof DrawerTitlePrimitive>) {
  return (
    <DrawerTitlePrimitive
      className={cn("cn-drawer-title font-heading", className)}
      {...props}
    />
  );
}

function DrawerDescription({
  className,
  ...props
}: ComponentProps<typeof DrawerDescriptionPrimitive>) {
  return (
    <DrawerDescriptionPrimitive
      className={cn("cn-drawer-description", className)}
      {...props}
    />
  );
}

export {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerTitle,
  DrawerTrigger,
};
