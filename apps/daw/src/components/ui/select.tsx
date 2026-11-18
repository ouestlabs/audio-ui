import {
  type ListData,
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
import {
  Children,
  type ComponentProps,
  isValidElement,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { usePopupContainer } from "@/hooks/use-popup-container";
import { CaretDownIcon, CheckIcon } from "@phosphor-icons/react";

// ui-sdk types `items` as a mutable list, the shared sources hold theirs as `as const`.
function Select<T = string>({
  container,
  items,
  ...props
}: Omit<SelectProps<T, false>, "items"> & {
  items?: ListData<T> | readonly unknown[];
}) {
  const popups = usePopupContainer();
  return (
    <SelectPrimitive<T>
      {...(props as SelectProps<T, false>)}
      container={container ?? popups}
      items={items as ListData<T> | undefined}
    />
  );
}

// A group without a label only wraps its items in the shadcn API, and ui-sdk misplaces the selected item over the trigger inside any group.
function SelectGroup({
  children,
  className,
  ...props
}: Omit<ComponentProps<typeof SelectGroupPrimitive>, "children"> & {
  children?: ReactNode;
}) {
  const labelled = Children.toArray(children).some(
    (child) => isValidElement(child) && child.type === SelectLabel
  );
  if (!labelled) {
    return children;
  }
  return (
    <SelectGroupPrimitive className={cn("scroll-my-1", className)} {...props}>
      {children}
    </SelectGroupPrimitive>
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
        "border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 gap-1.5 rounded-lg border bg-transparent py-2 pr-2 pl-2.5 text-sm transition-colors select-none focus-visible:ring-3 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:flex *:data-[slot=select-value]:gap-1.5 [&_svg:not([class*='size-'])]:size-4 flex w-fit items-center justify-between whitespace-nowrap outline-none disabled:cursor-not-allowed disabled:opacity-50 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      data-size={size}
      {...props}
    >
      {children}
      <CaretDownIcon className="text-muted-foreground size-4 pointer-events-none" />
    </SelectTriggerPrimitive>
  );
}

function SelectContent({
  className,
  side = "bottom",
  sideOffset = 4,
  align = "center",
  // Items go straight in SelectContent: inside a SelectGroup, ui-sdk misplaces the selected item over the trigger.
  alignItemWithTrigger = true,
  ...props
}: ComponentProps<typeof SelectContentPrimitive>) {
  return (
    <SelectContentPrimitive
      align={align}
      alignItemWithTrigger={alignItemWithTrigger}
      className={cn(
        "bg-popover text-popover-foreground data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 ring-foreground/10 min-w-36 rounded-lg shadow-md ring-1 duration-100 data-[side=inline-start]:slide-in-from-right-2 data-[side=inline-end]:slide-in-from-left-2 animate-none! relative bg-popover/70 before:pointer-events-none before:absolute before:inset-0 before:-z-1 before:rounded-[inherit] before:backdrop-blur-2xl before:backdrop-saturate-150 **:data-[slot$=-item]:focus:bg-foreground/10 **:data-[slot$=-item]:data-highlighted:bg-foreground/10 **:data-[slot$=-item]:focus:text-foreground **:data-[slot$=-item]:data-highlighted:text-foreground **:data-[slot$=-separator]:bg-foreground/5 **:data-[slot$=-trigger]:focus:bg-foreground/10 **:data-[slot$=-trigger]:focus:text-foreground **:data-[slot$=-trigger]:aria-expanded:text-foreground **:data-[slot$=-trigger]:aria-expanded:bg-foreground/10! **:data-[variant=destructive]:focus:bg-foreground/10! **:data-[variant=destructive]:text-accent-foreground! **:data-[variant=destructive]:**:text-accent-foreground! relative p-1 isolate z-50 max-h-(--available-height) w-(--anchor-width) origin-(--transform-origin) overflow-x-hidden overflow-y-auto data-[align-trigger=true]:animate-none",
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
    <SelectGroupLabel className={cn("text-muted-foreground px-1.5 py-1 text-xs", className)} {...props} />
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
        "focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2 relative flex w-full cursor-default items-center outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      {...props}
    >
      <span className="flex flex-1 gap-2 shrink-0 whitespace-nowrap">
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
      className={cn("bg-border -mx-1 my-1 h-px pointer-events-none", className)}
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