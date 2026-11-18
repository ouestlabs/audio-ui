import {
  ToastAction,
  ToastClose,
  type ToastData,
  ToastDescription,
  Toast as ToastPrimitive,
  ToastRegion,
  ToastTitle,
  toast,
} from "@ui-sdk/react/toast";
import type { ComponentProps, ReactNode } from "react";
import { IconPlaceholder } from "@/components/icon-placeholder";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ToasterPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

const ALIGNS = { center: "center", left: "start", right: "end" } as const;

function ToastIcon({ type }: { type: ToastData<ReactNode>["type"] }) {
  switch (type) {
    case "success":
      return (
        <IconPlaceholder
          aria-hidden="true"
          className="size-4 shrink-0"
          hugeicons="CheckmarkCircle02Icon"
          lucide="CircleCheckIcon"
          phosphor="CheckCircleIcon"
          remixicon="RiCheckboxCircleLine"
          tabler="IconCircleCheck"
        />
      );
    case "info":
      return (
        <IconPlaceholder
          aria-hidden="true"
          className="size-4 shrink-0"
          hugeicons="InformationCircleIcon"
          lucide="InfoIcon"
          phosphor="InfoIcon"
          remixicon="RiInformationLine"
          tabler="IconInfoCircle"
        />
      );
    case "warning":
      return (
        <IconPlaceholder
          aria-hidden="true"
          className="size-4 shrink-0"
          hugeicons="Alert02Icon"
          lucide="TriangleAlertIcon"
          phosphor="WarningIcon"
          remixicon="RiErrorWarningLine"
          tabler="IconAlertTriangle"
        />
      );
    case "error":
      return (
        <IconPlaceholder
          aria-hidden="true"
          className="size-4 shrink-0"
          hugeicons="MultiplicationSignCircleIcon"
          lucide="OctagonXIcon"
          phosphor="XCircleIcon"
          remixicon="RiCloseCircleLine"
          tabler="IconAlertOctagon"
        />
      );
    case "loading":
      return (
        <IconPlaceholder
          aria-hidden="true"
          className="size-4 shrink-0 animate-spin"
          hugeicons="Loading03Icon"
          lucide="Loader2Icon"
          phosphor="SpinnerIcon"
          remixicon="RiLoaderLine"
          tabler="IconLoader"
        />
      );
    default:
      return null;
  }
}

// `position` and `closeButton` are the shadcn API's names: `side` and `align` win when given.
function Toaster({
  align,
  className,
  closeButton = false,
  position = "bottom-right",
  side,
  ...props
}: Omit<ComponentProps<typeof ToastRegion>, "children"> & {
  closeButton?: boolean;
  position?: ToasterPosition;
}) {
  const [edge, along] = position.split("-") as [
    "top" | "bottom",
    keyof typeof ALIGNS,
  ];
  return (
    <ToastRegion
      align={align ?? ALIGNS[along]}
      className={cn(
        "group/toaster h-(--toast-front-height) w-[356px] max-w-[calc(100vw-2rem)] data-expanded:h-[calc(var(--toast-stack-height)+(var(--toast-count)-1)*--spacing(3))]",
        className
      )}
      side={side ?? edge}
      {...props}
    >
      {(data) => (
        <ToastPrimitive className="rounded-2xl absolute inset-x-0 bottom-0 z-[calc(100-var(--toast-index))] flex h-(--toast-height) [scale:calc(1-var(--toast-index)*0.05)] items-center gap-2 overflow-hidden border bg-popover p-4 text-popover-foreground text-sm shadow-lg transition-[translate,scale,opacity,height] duration-400 [--y:calc(var(--toast-index)*-1*--spacing(3))] [translate:var(--toast-swipe-x,0px)_calc(var(--y)+var(--toast-swipe-y,0px))] select-none not-data-expanded:not-data-front:h-(--toast-front-height) group-data-[side=top]/toaster:top-0 group-data-[side=top]/toaster:bottom-auto group-data-[side=top]/toaster:[--y:calc(var(--toast-index)*--spacing(3))] data-expanded:[--y:calc(-1*(var(--toast-offset)+var(--toast-index)*--spacing(3)))] data-expanded:[scale:1] group-data-[side=top]/toaster:data-expanded:[--y:calc(var(--toast-offset)+var(--toast-index)*--spacing(3))] data-starting-style:transition-none data-starting-style:data-front:[--y:100%] group-data-[side=top]/toaster:data-starting-style:data-front:[--y:-100%] data-starting-style:not-data-front:opacity-0 data-ending-style:opacity-0 data-swiping:transition-none motion-reduce:transition-opacity">
          <ToastIcon type={data.type} />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <ToastTitle className="font-medium" />
            <ToastDescription className="text-muted-foreground" />
          </div>
          {data.cancel ? (
            <ToastClose
              action={data.cancel.onCancel}
              className={buttonVariants({ size: "xs", variant: "secondary" })}
            >
              {data.cancel.label}
            </ToastClose>
          ) : null}
          <ToastAction className={buttonVariants({ size: "xs" })} />
          {closeButton ? (
            <ToastClose
              aria-label="Close"
              className={buttonVariants({ size: "icon-xs", variant: "ghost" })}
            >
              <IconPlaceholder
                hugeicons="Cancel01Icon"
                lucide="XIcon"
                phosphor="XIcon"
                remixicon="RiCloseLine"
                tabler="IconX"
              />
            </ToastClose>
          ) : null}
        </ToastPrimitive>
      )}
    </ToastRegion>
  );
}

export { Toaster, toast };
