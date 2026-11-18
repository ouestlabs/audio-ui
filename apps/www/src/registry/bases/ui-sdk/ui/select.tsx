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
import { IconPlaceholder } from "@/components/icon-placeholder";
import { cn } from "@/lib/utils";
import { usePopupContainer } from "@/registry/bases/ui-sdk/hooks/use-popup-container";

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
      className={cn("cn-select-value", className)}
      data-slot="select-value"
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
        "cn-select-trigger flex w-fit items-center justify-between whitespace-nowrap outline-none disabled:cursor-not-allowed disabled:opacity-50 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      data-size={size}
      {...props}
    >
      {children}
      <IconPlaceholder
        className="cn-select-trigger-icon pointer-events-none"
        hugeicons="UnfoldMoreIcon"
        lucide="ChevronDownIcon"
        phosphor="CaretDownIcon"
        remixicon="RiArrowDownSLine"
        tabler="IconSelector"
      />
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
        "cn-select-content cn-select-content-logical cn-menu-translucent relative p-1 isolate z-50 max-h-(--available-height) w-(--anchor-width) origin-(--transform-origin) overflow-x-hidden overflow-y-auto data-[align-trigger=true]:animate-none",
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
    <SelectGroupLabel className={cn("cn-select-label", className)} {...props} />
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
        "cn-select-item relative flex w-full cursor-default items-center outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      {...props}
    >
      <span className="cn-select-item-text shrink-0 whitespace-nowrap">
        {children}
      </span>
      <SelectItemIndicator className="cn-select-item-indicator">
        <IconPlaceholder
          className="pointer-events-none"
          hugeicons="Tick02Icon"
          lucide="CheckIcon"
          phosphor="CheckIcon"
          remixicon="RiCheckLine"
          tabler="IconCheck"
        />
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
      className={cn("cn-select-separator pointer-events-none", className)}
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
