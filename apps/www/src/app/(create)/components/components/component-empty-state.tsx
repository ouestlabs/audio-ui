import { MagnifyingGlassIcon } from "@phosphor-icons/react/ssr";
import type { ReactNode } from "react";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/registry/bases/base/ui/empty";

interface ComponentEmptyStateProps {
  /** What to do next, such as a link back to the whole catalog. */
  children?: ReactNode;
  className?: string;
  description?: string;
  title: string;
}

export function ComponentEmptyState({
  children,
  className,
  description,
  title,
}: ComponentEmptyStateProps) {
  return (
    <Empty className={className}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <MagnifyingGlassIcon aria-hidden />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description ? (
          <EmptyDescription>{description}</EmptyDescription>
        ) : null}
      </EmptyHeader>
      {children ? <EmptyContent>{children}</EmptyContent> : null}
    </Empty>
  );
}
