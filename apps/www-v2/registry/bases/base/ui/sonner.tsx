"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

import { IconPlaceholder } from "@/app/(create)/components/icon-placeholder";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      className="toaster group"
      icons={{
        success: (
          <IconPlaceholder
            className="size-4"
            hugeicons="CheckmarkCircle02Icon"
            lucide="CircleCheckIcon"
            phosphor="CheckCircleIcon"
            remixicon="RiCheckboxCircleLine"
            tabler="IconCircleCheck"
          />
        ),
        info: (
          <IconPlaceholder
            className="size-4"
            hugeicons="InformationCircleIcon"
            lucide="InfoIcon"
            phosphor="InfoIcon"
            remixicon="RiInformationLine"
            tabler="IconInfoCircle"
          />
        ),
        warning: (
          <IconPlaceholder
            className="size-4"
            hugeicons="Alert02Icon"
            lucide="TriangleAlertIcon"
            phosphor="WarningIcon"
            remixicon="RiErrorWarningLine"
            tabler="IconAlertTriangle"
          />
        ),
        error: (
          <IconPlaceholder
            className="size-4"
            hugeicons="MultiplicationSignCircleIcon"
            lucide="OctagonXIcon"
            phosphor="XCircleIcon"
            remixicon="RiCloseCircleLine"
            tabler="IconAlertOctagon"
          />
        ),
        loading: (
          <IconPlaceholder
            className="size-4 animate-spin"
            hugeicons="Loading03Icon"
            lucide="Loader2Icon"
            phosphor="SpinnerIcon"
            remixicon="RiLoaderLine"
            tabler="IconLoader"
          />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      theme={theme as ToasterProps["theme"]}
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
