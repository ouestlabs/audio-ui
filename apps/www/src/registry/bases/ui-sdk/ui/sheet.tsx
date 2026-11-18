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
import { cn } from "@/lib/utils";
import { usePopupContainer } from "@/registry/bases/ui-sdk/hooks/use-popup-container";
import { Button } from "@/registry/bases/ui-sdk/ui/button";

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
        "cn-sheet-overlay fixed inset-0 z-50 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0",
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
          "cn-sheet-content data-ending-style:opacity-0 data-starting-style:opacity-0 data-[side=bottom]:data-ending-style:translate-y-[2.5rem] data-[side=bottom]:data-starting-style:translate-y-[2.5rem] data-[side=left]:data-ending-style:translate-x-[-2.5rem] data-[side=left]:data-starting-style:translate-x-[-2.5rem] data-[side=right]:data-ending-style:translate-x-[2.5rem] data-[side=right]:data-starting-style:translate-x-[2.5rem] data-[side=top]:data-ending-style:translate-y-[-2.5rem] data-[side=top]:data-starting-style:translate-y-[-2.5rem]",
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
                className="cn-sheet-close"
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
      className={cn("cn-sheet-header flex flex-col", className)}
      data-slot="sheet-header"
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("cn-sheet-footer mt-auto flex flex-col", className)}
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
      className={cn("cn-sheet-title font-heading", className)}
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
      className={cn("cn-sheet-description", className)}
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
