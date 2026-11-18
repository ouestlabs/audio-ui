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
import { usePopupContainer } from "@/hooks/use-popup-container";
import { cn } from "@/lib/utils";

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
      className={cn(
        "bg-black/10 supports-backdrop-filter:backdrop-blur-xs fixed inset-0 z-50",
        className
      )}
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
          "bg-popover text-popover-foreground flex h-auto flex-col text-sm data-[side=bottom]:rounded-t-xl data-[side=bottom]:border-t data-[side=left]:rounded-r-xl data-[side=left]:border-r data-[side=right]:rounded-l-xl data-[side=right]:border-l data-[side=top]:rounded-b-xl data-[side=top]:border-b group/drawer-content z-50 outline-none data-[side=bottom]:max-h-[80vh] data-[side=bottom]:w-full data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=top]:max-h-[80vh] data-[side=top]:w-full data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm",
          className
        )}
        {...props}
      >
        <div
          aria-hidden="true"
          className="bg-muted mx-auto mt-4 hidden h-1 w-[100px] shrink-0 rounded-full group-data-[side=bottom]/drawer-content:block"
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
        "gap-0.5 p-4 md:gap-0.5 md:text-left flex flex-col group-data-[side=bottom]/drawer-content:text-center group-data-[side=top]/drawer-content:text-center",
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
      className={cn("gap-2 p-4 mt-auto flex flex-col", className)}
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
      className={cn(
        "text-foreground text-base font-medium font-heading",
        className
      )}
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
      className={cn("text-muted-foreground text-sm", className)}
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
