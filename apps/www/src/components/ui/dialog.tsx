import { XIcon } from "@phosphor-icons/react/ssr";
import {
  DialogBackdrop,
  DialogClose,
  DialogContent as DialogContentPrimitive,
  DialogDescription as DialogDescriptionPrimitive,
  Dialog as DialogPrimitive,
  DialogTitle as DialogTitlePrimitive,
  DialogTrigger,
} from "@ui-sdk/react/dialog";
import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePopupContainer } from "@/registry/bases/ui-sdk/hooks/use-popup-container";

function Dialog({
  container,
  ...props
}: ComponentProps<typeof DialogPrimitive>) {
  const popups = usePopupContainer();
  return <DialogPrimitive container={container ?? popups} {...props} />;
}

/*
 * Below the popups (z-50), not level with them: a menu or a popover opened
 * from inside a dialog lives in a portal of its own, and between two layers at
 * the same level the one whose portal was added last wins, which on a second
 * opening of the dialog is the dialog.
 */
function DialogOverlay({
  className,
  ...props
}: ComponentProps<typeof DialogBackdrop>) {
  return (
    <DialogBackdrop
      className={cn(
        "data-open:fade-in-0 data-closed:fade-out-0 fixed inset-0 isolate z-45 bg-black/10 ease-[cubic-bezier(0.22,1,0.36,1)] data-closed:animate-out data-closed:duration-150 data-open:animate-in data-open:duration-250 supports-backdrop-filter:backdrop-blur-xs",
        className
      )}
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
          "-translate-x-1/2 -translate-y-1/2 data-open:fade-in-0 data-open:zoom-in-96 data-closed:fade-out-0 data-closed:zoom-out-96 fixed top-1/2 left-1/2 z-45 grid w-full max-w-[calc(100%-2rem)] gap-4 rounded-xl bg-popover p-4 text-popover-foreground text-sm outline-none ring-1 ring-foreground/10 ease-[cubic-bezier(0.22,1,0.36,1)] data-closed:animate-out data-closed:duration-150 data-open:animate-in data-open:duration-250 sm:max-w-sm",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton ? (
          <DialogClose
            render={
              <Button
                className="absolute top-2 right-2"
                size="icon-sm"
                variant="ghost"
              />
            }
          >
            <XIcon />
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
      className={cn("flex flex-col gap-2", className)}
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
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
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
      className={cn(
        "font-heading font-medium text-base leading-none",
        className
      )}
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
      className={cn(
        "text-muted-foreground text-sm *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
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
