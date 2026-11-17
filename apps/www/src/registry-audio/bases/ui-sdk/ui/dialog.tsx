import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogContent as DialogContentPrimitive,
  DialogDescription as DialogDescriptionPrimitive,
  DialogTitle as DialogTitlePrimitive,
  DialogTrigger,
} from "@ui-sdk/react/dialog";
import type { ComponentProps, ReactNode } from "react";
import { IconPlaceholder } from "@/components/icon-placeholder";
import { cn } from "@/lib/utils";
import { Button } from "@/registry-audio/bases/ui-sdk/ui/button";

function DialogOverlay({
  className,
  ...props
}: ComponentProps<typeof DialogBackdrop>) {
  return (
    <DialogBackdrop
      className={cn("cn-dialog-overlay fixed inset-0 isolate z-50", className)}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: Omit<ComponentProps<typeof DialogContentPrimitive>, "children"> & {
  children?: ReactNode;
  showCloseButton?: boolean;
}) {
  return (
    <>
      <DialogOverlay />
      <DialogContentPrimitive
        className={cn(
          "cn-dialog-content fixed top-1/2 left-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2 outline-none",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton ? (
          <DialogClose
            render={
              <Button
                className="cn-dialog-close"
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
      </DialogContentPrimitive>
    </>
  );
}

function DialogHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("cn-dialog-header flex flex-col", className)}
      data-slot="dialog-header"
      {...props}
    />
  );
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: ComponentProps<"div"> & {
  showCloseButton?: boolean;
}) {
  return (
    <div
      className={cn(
        "cn-dialog-footer flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      data-slot="dialog-footer"
      {...props}
    >
      {children}
      {showCloseButton ? (
        <DialogClose render={<Button variant="outline" />}>Close</DialogClose>
      ) : null}
    </div>
  );
}

function DialogTitle({
  className,
  ...props
}: ComponentProps<typeof DialogTitlePrimitive>) {
  return (
    <DialogTitlePrimitive
      className={cn("cn-dialog-title font-heading", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogDescriptionPrimitive>) {
  return (
    <DialogDescriptionPrimitive
      className={cn("cn-dialog-description", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
  DialogTrigger,
};
