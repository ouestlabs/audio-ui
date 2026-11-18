import {
  PaginationEllipsis as PaginationEllipsisPrimitive,
  PaginationItem,
  PaginationLink as PaginationLinkPrimitive,
  PaginationList,
  PaginationNext as PaginationNextPrimitive,
  PaginationPrevious as PaginationPreviousPrimitive,
  Pagination as PaginationPrimitive,
} from "@ui-sdk/react/pagination";
import type { VariantProps } from "class-variance-authority";
import { type ComponentProps, useCallback } from "react";
import { IconPlaceholder } from "@/components/icon-placeholder";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/registry/bases/ui-sdk/ui/button";

function Pagination({
  className,
  ...props
}: ComponentProps<typeof PaginationPrimitive>) {
  return (
    <PaginationPrimitive
      aria-label="pagination"
      className={cn("mx-auto flex w-full justify-center", className)}
      {...props}
    />
  );
}

function PaginationContent({
  className,
  ...props
}: ComponentProps<typeof PaginationList>) {
  return (
    <PaginationList
      className={cn("cn-pagination-content flex items-center", className)}
      {...props}
    />
  );
}

// ui-sdk marks the current page itself: it takes the outline look of the shadcn API's `isActive`.
function PaginationLink({
  className,
  size = "icon",
  ...props
}: Omit<ComponentProps<typeof PaginationLinkPrimitive>, "className"> &
  Pick<VariantProps<typeof buttonVariants>, "size"> & {
    className?: string;
  }) {
  const classes = useCallback(
    (state: { current: boolean }) =>
      cn(
        buttonVariants({
          size,
          variant: state.current ? "outline" : "ghost",
        }),
        className
      ),
    [className, size]
  );
  return <PaginationLinkPrimitive className={classes} {...props} />;
}

function PaginationPrevious({
  className,
  text = "Previous",
  ...props
}: ComponentProps<typeof PaginationPreviousPrimitive> & { text?: string }) {
  return (
    <PaginationPreviousPrimitive
      aria-label="Go to previous page"
      className={cn(
        buttonVariants({ size: "default", variant: "ghost" }),
        "cn-pagination-previous",
        className
      )}
      {...props}
    >
      <IconPlaceholder
        className="rtl:rotate-180"
        data-icon="inline-start"
        hugeicons="ArrowLeft01Icon"
        lucide="ChevronLeftIcon"
        phosphor="CaretLeftIcon"
        remixicon="RiArrowLeftSLine"
        tabler="IconChevronLeft"
      />
      <span className="hidden sm:block">{text}</span>
    </PaginationPreviousPrimitive>
  );
}

function PaginationNext({
  className,
  text = "Next",
  ...props
}: ComponentProps<typeof PaginationNextPrimitive> & { text?: string }) {
  return (
    <PaginationNextPrimitive
      aria-label="Go to next page"
      className={cn(
        buttonVariants({ size: "default", variant: "ghost" }),
        "cn-pagination-next",
        className
      )}
      {...props}
    >
      <span className="hidden sm:block">{text}</span>
      <IconPlaceholder
        className="rtl:rotate-180"
        data-icon="inline-end"
        hugeicons="ArrowRight01Icon"
        lucide="ChevronRightIcon"
        phosphor="CaretRightIcon"
        remixicon="RiArrowRightSLine"
        tabler="IconChevronRight"
      />
    </PaginationNextPrimitive>
  );
}

function PaginationEllipsis({
  className,
  ...props
}: ComponentProps<typeof PaginationEllipsisPrimitive>) {
  return (
    <PaginationEllipsisPrimitive
      className={cn(
        "cn-pagination-ellipsis flex items-center justify-center",
        className
      )}
      {...props}
    >
      <IconPlaceholder
        hugeicons="MoreHorizontalCircle01Icon"
        lucide="MoreHorizontalIcon"
        phosphor="DotsThreeIcon"
        remixicon="RiMoreLine"
        tabler="IconDots"
      />
    </PaginationEllipsisPrimitive>
  );
}

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
};
