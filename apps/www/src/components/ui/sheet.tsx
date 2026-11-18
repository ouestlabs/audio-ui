import {
  DialogBackdrop,
  DialogClose,
  DialogContent,
  DialogDescription as DialogDescriptionPrimitive,
  Dialog as DialogPrimitive,
  DialogTitle as DialogTitlePrimitive,
  DialogTrigger,
} from "@ui-sdk/react/dialog";
import type { ComponentProps, ReactNode } from "react";
import { IconPlaceholder } from "@/components/icon-placeholder";
import { Button } from "@/components/ui/button";
import { usePopupContainer } from "@/hooks/use-popup-container";
import { cn } from "@/lib/utils";

function Sheet({
  container,
  ...props
}: ComponentProps<typeof DialogPrimitive>) {
  const popups = usePopupContainer();
  return <DialogPrimitive container={container ?? popups} {...props} />;
}

function SheetOverlay({
  className,
  ...props
}: ComponentProps<typeof DialogBackdrop>) {
  return (
    <DialogBackdrop
      className={cn(
        "bg-black/10 supports-backdrop-filter:backdrop-blur-xs fixed inset-0 z-50 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0",
        className
      )}
      {...props}
    />
  );
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: Omit<ComponentProps<typeof DialogContent>, "children"> & {
  children?: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  showCloseButton?: boolean;
}) {
  return (
    <>
      <SheetOverlay />
      <DialogContent
        className={cn(
          "bg-popover text-popover-foreground fixed z-50 flex flex-col gap-4 bg-clip-padding text-sm shadow-lg transition duration-200 ease-in-out data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm data-ending-style:opacity-0 data-starting-style:opacity-0 data-[side=bottom]:data-ending-style:translate-y-[2.5rem] data-[side=bottom]:data-starting-style:translate-y-[2.5rem] data-[side=left]:data-ending-style:translate-x-[-2.5rem] data-[side=left]:data-starting-style:translate-x-[-2.5rem] data-[side=right]:data-ending-style:translate-x-[2.5rem] data-[side=right]:data-starting-style:translate-x-[2.5rem] data-[side=top]:data-ending-style:translate-y-[-2.5rem] data-[side=top]:data-starting-style:translate-y-[-2.5rem]",
          className
        )}
        data-side={side}
        {...props}
      >
        {children}
        {showCloseButton ? (
          <DialogClose
            render={
              <Button
                className="absolute top-3 right-3"
                size="icon-sm"
                variant="ghost"
              />
            }
          >
            <IconPlaceholder
              hugeicons="Cancel01Icon"
              lucide="XIcon"
              phosphor="XIcon"
              remixicon="RiCloseLine"
              tabler="IconX"
            />
            <span className="sr-only">Close</span>
          </DialogClose>
        ) : null}
      </DialogContent>
    </>
  );
}

function SheetHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("gap-0.5 p-4 flex flex-col", className)}
      data-slot="sheet-header"
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("gap-2 p-4 mt-auto flex flex-col", className)}
      data-slot="sheet-footer"
      {...props}
    />
  );
}

function SheetTitle({
  className,
  ...props
}: ComponentProps<typeof DialogTitlePrimitive>) {
  return (
    <DialogTitlePrimitive
      className={cn(
        "text-foreground text-base font-medium font-heading",
        className
      )}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: ComponentProps<typeof DialogDescriptionPrimitive>) {
  return (
    <DialogDescriptionPrimitive
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export {
  DialogClose as SheetClose,
  DialogTrigger as SheetTrigger,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
};
