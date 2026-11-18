import {
  ProgressIndicator as ProgressIndicatorPrimitive,
  ProgressLabel as ProgressLabelPrimitive,
  Progress as ProgressPrimitive,
  ProgressTrack as ProgressTrackPrimitive,
  ProgressValue as ProgressValuePrimitive,
} from "@ui-sdk/react/progress";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

function Progress({
  className,
  children,
  ...props
}: Omit<ComponentProps<typeof ProgressPrimitive>, "children"> & {
  children?: ReactNode;
}) {
  return (
    <ProgressPrimitive
      className={cn("flex flex-wrap gap-3", className)}
      {...props}
    >
      {children}
      <ProgressTrack>
        <ProgressIndicator />
      </ProgressTrack>
    </ProgressPrimitive>
  );
}

function ProgressTrack({
  className,
  ...props
}: ComponentProps<typeof ProgressTrackPrimitive>) {
  return (
    <ProgressTrackPrimitive
      className={cn(
        "cn-progress-track relative flex w-full items-center overflow-x-hidden",
        className
      )}
      {...props}
    />
  );
}

function ProgressIndicator({
  className,
  ...props
}: ComponentProps<typeof ProgressIndicatorPrimitive>) {
  return (
    <ProgressIndicatorPrimitive
      className={cn("cn-progress-indicator h-full transition-all", className)}
      {...props}
    />
  );
}

function ProgressLabel({
  className,
  ...props
}: ComponentProps<typeof ProgressLabelPrimitive>) {
  return (
    <ProgressLabelPrimitive
      className={cn("cn-progress-label", className)}
      {...props}
    />
  );
}

function ProgressValue({
  className,
  ...props
}: ComponentProps<typeof ProgressValuePrimitive>) {
  return (
    <ProgressValuePrimitive
      className={cn("cn-progress-value", className)}
      {...props}
    />
  );
}

export {
  Progress,
  ProgressIndicator,
  ProgressLabel,
  ProgressTrack,
  ProgressValue,
};
