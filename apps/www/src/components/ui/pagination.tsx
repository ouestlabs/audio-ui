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
import type { ComponentProps } from "react";
import { IconPlaceholder } from "@/components/icon-placeholder";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
      className={cn("gap-0.5 flex items-center", className)}
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
  return (
    <PaginationLinkPrimitive
      className={(state) =>
        cn(
          buttonVariants({
            size,
            variant: state.current ? "outline" : "ghost",
          }),
          className
        )
      }
      {...props}
    />
  );
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
        "pl-1.5!",
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
        "pr-1.5!",
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
        "size-8 items-center justify-center [&_svg:not([class*='size-'])]:size-4 flex",
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
