import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogClose,
  AlertDialogContent as AlertDialogContentPrimitive,
  AlertDialogDescription as AlertDialogDescriptionPrimitive,
  AlertDialogTitle as AlertDialogTitlePrimitive,
  AlertDialogTrigger,
} from "@ui-sdk/react/alert-dialog";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/registry/bases/ui-sdk/ui/button";

function AlertDialogOverlay({
  className,
  ...props
}: ComponentProps<typeof AlertDialogBackdrop>) {
  return (
    <AlertDialogBackdrop
      className={cn(
        "cn-alert-dialog-overlay fixed inset-0 isolate z-50",
        className
      )}
      {...props}
    />
  );
}

function AlertDialogContent({
  className,
  size = "default",
  ...props
}: Omit<ComponentProps<typeof AlertDialogContentPrimitive>, "children"> & {
  children?: ReactNode;
  size?: "default" | "sm";
}) {
  return (
    <>
      <AlertDialogOverlay />
      <AlertDialogContentPrimitive
        className={cn(
          "cn-alert-dialog-content group/alert-dialog-content fixed top-1/2 left-1/2 z-50 grid w-full -translate-x-1/2 -translate-y-1/2 outline-none",
          className
        )}
        data-size={size}
        {...props}
      />
    </>
  );
}

function AlertDialogHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("cn-alert-dialog-header", className)}
      data-slot="alert-dialog-header"
      {...props}
    />
  );
}

function AlertDialogFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "cn-alert-dialog-footer flex flex-col-reverse gap-2 group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2 sm:flex-row sm:justify-end",
        className
      )}
      data-slot="alert-dialog-footer"
      {...props}
    />
  );
}

function AlertDialogMedia({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("cn-alert-dialog-media", className)}
      data-slot="alert-dialog-media"
      {...props}
    />
  );
}

function AlertDialogTitle({
  className,
  ...props
}: ComponentProps<typeof AlertDialogTitlePrimitive>) {
  return (
    <AlertDialogTitlePrimitive
      className={cn("cn-alert-dialog-title font-heading", className)}
      {...props}
    />
  );
}

function AlertDialogDescription({
  className,
  ...props
}: ComponentProps<typeof AlertDialogDescriptionPrimitive>) {
  return (
    <AlertDialogDescriptionPrimitive
      className={cn("cn-alert-dialog-description", className)}
      {...props}
    />
  );
}

function AlertDialogAction({
  className,
  variant,
  size,
  ...props
}: Omit<ComponentProps<typeof AlertDialogClose>, "children"> &
  Pick<ComponentProps<typeof Button>, "variant" | "size"> & {
    children?: ReactNode;
  }) {
  return (
    <AlertDialogClose
      render={<Button size={size} variant={variant} />}
      value="confirm"
      {...props}
    />
  );
}

function AlertDialogCancel({
  className,
  variant = "outline",
  size = "default",
  ...props
}: Omit<ComponentProps<typeof AlertDialogClose>, "children"> &
  Pick<ComponentProps<typeof Button>, "variant" | "size"> & {
    children?: ReactNode;
  }) {
  return (
    <AlertDialogClose
      render={<Button size={size} variant={variant} />}
      {...props}
    />
  );
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogOverlay,
  AlertDialogTitle,
  AlertDialogTrigger,
};
