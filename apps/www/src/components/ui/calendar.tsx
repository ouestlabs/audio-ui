import {
  CalendarDay,
  CalendarGrid,
  CalendarHeading,
  CalendarMonthSelect,
  CalendarNext,
  CalendarPrevious,
  Calendar as CalendarPrimitive,
  CalendarWeekday,
  CalendarWeekdays,
  CalendarWeeks,
  CalendarYearSelect,
} from "@ui-sdk/react/calendar";
import type { VariantProps } from "class-variance-authority";
import type { ComponentProps, ReactNode } from "react";
import { IconPlaceholder } from "@/components/icon-placeholder";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DROPDOWN =
  "h-(--cell-size) appearance-none rounded-(--cell-radius) bg-transparent ps-2 pe-6 font-medium text-sm outline-none disabled:opacity-50";

function CalendarDropdown({ children }: { children: ReactNode }) {
  return (
    <span className="has-focus:border-ring border-input has-focus:ring-ring/50 border has-focus:ring-3 relative flex items-center rounded-(--cell-radius)">
      {children}
      <IconPlaceholder
        className="pointer-events-none absolute inset-e-1.5 size-3.5 text-muted-foreground"
        hugeicons="ArrowDownIcon"
        lucide="ChevronDownIcon"
        phosphor="CaretDownIcon"
        remixicon="RiArrowDownSLine"
        tabler="IconChevronDown"
      />
    </span>
  );
}

// Dates are ISO strings, like "2026-10-16": a value is one, a list of them, or a [start, end] range.
function Calendar({
  buttonVariant = "ghost",
  captionLayout = "label",
  className,
  months = 1,
  showOutsideDays = true,
  ...props
}: Omit<ComponentProps<typeof CalendarPrimitive>, "children"> & {
  buttonVariant?: VariantProps<typeof buttonVariants>["variant"];
  captionLayout?: "label" | "dropdown";
}) {
  const offsets = Array.from({ length: months }, (_, offset) => offset);
  return (
    <CalendarPrimitive
      className={cn(
        "p-2 [--cell-radius:var(--radius-md)] [--cell-size:--spacing(7)] group/calendar flex w-fit flex-col gap-4 bg-background in-data-[slot=card-content]:bg-transparent in-data-[slot=popover-content]:bg-transparent",
        className
      )}
      months={months}
      showOutsideDays={showOutsideDays}
      {...props}
    >
      <div className="flex h-(--cell-size) w-full items-center justify-between gap-1">
        <CalendarPrevious
          className={cn(
            buttonVariants({ variant: buttonVariant }),
            "size-(--cell-size) p-0 select-none"
          )}
        >
          <IconPlaceholder
            className="size-4 rtl:rotate-180"
            hugeicons="ArrowLeftIcon"
            lucide="ChevronLeftIcon"
            phosphor="CaretLeftIcon"
            remixicon="RiArrowLeftSLine"
            tabler="IconChevronLeft"
          />
        </CalendarPrevious>
        {captionLayout === "dropdown" ? (
          <div className="flex items-center justify-center gap-1.5 font-medium text-sm">
            <CalendarDropdown>
              <CalendarMonthSelect className={DROPDOWN} />
            </CalendarDropdown>
            <CalendarDropdown>
              <CalendarYearSelect className={DROPDOWN} />
            </CalendarDropdown>
          </div>
        ) : (
          <CalendarHeading className=" font-medium text-sm select-none" />
        )}
        <CalendarNext
          className={cn(
            buttonVariants({ variant: buttonVariant }),
            "size-(--cell-size) p-0 select-none"
          )}
        >
          <IconPlaceholder
            className="size-4 rtl:rotate-180"
            hugeicons="ArrowRightIcon"
            lucide="ChevronRightIcon"
            phosphor="CaretRightIcon"
            remixicon="RiArrowRightSLine"
            tabler="IconChevronRight"
          />
        </CalendarNext>
      </div>
      <div className="flex flex-col gap-4 md:flex-row">
        {offsets.map((offset) => (
          <CalendarGrid
            className="border-separate border-spacing-x-0 border-spacing-y-1"
            key={offset}
            offset={offset}
          >
            <CalendarWeekdays>
              {(index) => (
                <CalendarWeekday
                  className="w-(--cell-size) font-normal text-[0.8rem] text-muted-foreground select-none"
                  index={index}
                />
              )}
            </CalendarWeekdays>
            <CalendarWeeks>
              {(cell) => (
                <CalendarDay
                  className="relative size-(--cell-size) cursor-default rounded-(--cell-radius) p-0 text-center text-sm outline-none select-none not-data-selected:hover:bg-muted focus-visible:z-10 focus-visible:ring-[3px] focus-visible:ring-ring/50 data-disabled:text-muted-foreground data-disabled:opacity-50 data-disabled:hover:bg-transparent data-outside:text-muted-foreground data-preview:bg-muted data-range-middle:rounded-none data-range-middle:bg-muted data-range-middle:text-foreground data-range-end:not-data-range-start:rounded-s-none data-range-start:not-data-range-end:rounded-e-none data-selected:not-data-range-middle:bg-primary data-selected:not-data-range-middle:text-primary-foreground data-today:not-data-selected:bg-muted data-today:not-data-selected:text-foreground"
                  value={cell.date}
                />
              )}
            </CalendarWeeks>
          </CalendarGrid>
        ))}
      </div>
    </CalendarPrimitive>
  );
}

export { Calendar };
