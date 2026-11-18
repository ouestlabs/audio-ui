import { CaretDownIcon, CheckIcon } from "@phosphor-icons/react";
import {
  SelectContent as SelectContentPrimitive,
  SelectGroupLabel,
  SelectGroup as SelectGroupPrimitive,
  SelectItemIndicator,
  SelectItem as SelectItemPrimitive,
  Select as SelectPrimitive,
  type SelectProps,
  SelectSeparator as SelectSeparatorPrimitive,
  SelectTrigger as SelectTriggerPrimitive,
  SelectValue as SelectValuePrimitive,
} from "@ui-sdk/react/select";
import { cn } from "cn";
import type { ComponentProps, ReactNode } from "react";
import { usePopupContainer } from "@/registry-audio/bases/ui-sdk/hooks/use-popup-container";

function Select<T = string>({ container, ...props }: SelectProps<T, false>) {
  const popups = usePopupContainer();
  return <SelectPrimitive<T> container={container ?? popups} {...props} />;
}

function SelectGroup({
  className,
  ...props
}: ComponentProps<typeof SelectGroupPrimitive>) {
  return (
    <SelectGroupPrimitive className={cn("scroll-my-1", className)} {...props} />
  );
}

function SelectValue({
  className,
  ...props
}: ComponentProps<typeof SelectValuePrimitive>) {
  return (
    <SelectValuePrimitive
      className={cn("flex flex-1 text-left", className)}
      {...props}
    />
  );
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: Omit<ComponentProps<typeof SelectTriggerPrimitive>, "children"> & {
  children?: ReactNode;
  size?: "sm" | "default";
}) {
  return (
    <SelectTriggerPrimitive
      className={cn(
        "flex w-fit items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      data-size={size}
      {...props}
    >
      {children}
      <CaretDownIcon className="pointer-events-none size-4 text-muted-foreground" />
    </SelectTriggerPrimitive>
  );
}

function SelectContent({
  className,
  side = "bottom",
  sideOffset = 4,
  alignItemWithTrigger = true,
  ...props
}: ComponentProps<typeof SelectContentPrimitive>) {
  return (
    <SelectContentPrimitive
      alignItemWithTrigger={alignItemWithTrigger}
      className={cn(
        "relative isolate z-50 max-h-(--available-height) w-(--anchor-width) min-w-36 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[align-trigger=true]:animate-none data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
        className
      )}
      data-align-trigger={alignItemWithTrigger}
      side={side}
      sideOffset={sideOffset}
      {...props}
    />
  );
}

function SelectLabel({
  className,
  ...props
}: ComponentProps<typeof SelectGroupLabel>) {
  return (
    <SelectGroupLabel
      className={cn("px-1.5 py-1 text-xs text-muted-foreground", className)}
      data-slot="select-label"
      {...props}
    />
  );
}

function SelectItem({
  className,
  children,
  ...props
}: Omit<ComponentProps<typeof SelectItemPrimitive>, "children"> & {
  children?: ReactNode;
}) {
  return (
    <SelectItemPrimitive
      className={cn(
        "relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground not-data-[variant=destructive]:data-highlighted:**:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className
      )}
      {...props}
    >
      <span className="flex flex-1 shrink-0 gap-2 whitespace-nowrap">
        {children}
      </span>
      <SelectItemIndicator className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
        <CheckIcon className="pointer-events-none" />
      </SelectItemIndicator>
    </SelectItemPrimitive>
  );
}

function SelectSeparator({
  className,
  ...props
}: ComponentProps<typeof SelectSeparatorPrimitive>) {
  return (
    <SelectSeparatorPrimitive
      className={cn("pointer-events-none -mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
