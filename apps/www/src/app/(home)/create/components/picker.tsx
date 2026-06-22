"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { CaretUpDownIcon, CheckIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { cn } from "@/registry/default/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/registry/default/ui/popover";

export type PickerOption<T extends string> = {
  value: T;
  label: ReactNode;
  swatch?: ReactNode;
};

export function Picker<T extends string>({
  label,
  display,
  indicator,
  value,
  options,
  onValueChange,
  disabled,
}: {
  label: string;
  display: ReactNode;
  indicator?: ReactNode;
  value: T;
  options: PickerOption<T>[];
  onValueChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "relative flex w-full items-center rounded-xl px-3 py-2 text-left ring-1 ring-foreground/10 transition-colors",
          "hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          disabled && "cursor-not-allowed opacity-60 hover:bg-transparent"
        )}
        disabled={disabled}
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-muted-foreground text-xs">{label}</span>
          <span className="truncate font-medium text-foreground text-sm">
            {display}
          </span>
        </span>
        <span className="ml-2 flex shrink-0 items-center justify-center text-muted-foreground">
          {indicator ?? (
            <CaretUpDownIcon aria-hidden="true" className="size-4" />
          )}
        </span>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="dark max-h-72 w-56 gap-0 overflow-y-auto rounded-2xl bg-popover p-1 text-popover-foreground"
        side="right"
        sideOffset={10}
      >
        {options.map((option) => (
          <PopoverPrimitive.Close
            className={cn(
              "flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left text-sm transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              value === option.value && "bg-accent text-accent-foreground"
            )}
            key={option.value}
            onClick={() => onValueChange(option.value)}
          >
            {option.swatch}
            <span className="min-w-0 flex-1 truncate">{option.label}</span>
            {value === option.value && (
              <CheckIcon aria-hidden="true" className="size-4 shrink-0" />
            )}
          </PopoverPrimitive.Close>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export function Swatch({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      className="size-4 shrink-0 rounded-full ring-1 ring-foreground/15"
      style={{ backgroundColor: color }}
    />
  );
}
