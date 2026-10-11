"use client";

import { CaretRightIcon } from "@phosphor-icons/react/ssr";
import * as React from "react";
import { Frame, FrameContent, FrameHeader } from "@/components/custom/frame";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface TypeTableState {
  /** What "Expand all" and "Collapse all" last asked for, and when: a row follows it when it changes. */
  open: boolean;
  version: number;
}

const TypeTableContext = React.createContext<TypeTableState>({
  open: false,
  version: 0,
});

interface TypeRowProps {
  /** What the row says about the name: for a prop, its description. */
  children?: React.ReactNode;
  /** The value it has when left out. */
  default?: string;
  name: string;
  /** Whether it must be given. */
  required?: boolean;
  /** Its type, as written. */
  type?: string;
}

const hasDetails = ({ default: defaultValue, type }: TypeRowProps) =>
  Boolean(type || defaultValue);

/**
 * A reference table in the site's frame: a header, then a row per prop that
 * opens to show what it takes and what it does. "Expand all" opens every row.
 * Rows without a type or a default, such as data attributes, say everything
 * on one line.
 */
export function TypeTable({
  children,
  className,
  title = "Props",
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  const rows = React.Children.toArray(children);
  const collapsible = rows.some(
    (row) => React.isValidElement(row) && hasDetails(row.props as TypeRowProps)
  );
  const [state, setState] = React.useState<TypeTableState>({
    open: false,
    version: 0,
  });
  const toggleAll = React.useCallback(
    () =>
      setState((current) => ({
        open: !current.open,
        version: current.version + 1,
      })),
    []
  );
  return (
    <Frame className={cn("not-prose my-6", className)} data-slot="type-table">
      <FrameHeader className="flex-row items-center justify-between gap-3 px-2 py-1">
        <p className="ps-1 font-mono text-site-muted-foreground text-xs">
          {title} <span className="opacity-60">· {rows.length}</span>
        </p>
        {collapsible ? (
          <Button onClick={toggleAll} size="sm" type="button" variant="ghost">
            {state.open ? "Collapse all" : "Expand all"}
          </Button>
        ) : null}
      </FrameHeader>
      <FrameContent className="divide-y divide-site-border">
        <TypeTableContext value={state}>{children}</TypeTableContext>
      </FrameContent>
    </Frame>
  );
}

const codeClassName =
  "rounded-md bg-site-muted px-1.5 py-0.5 font-mono text-[0.8125rem]";

/** One entry of a `TypeTable`: its name, then what it takes (`type`, `default`) and the children that say what it does. */
export function TypeRow(props: TypeRowProps) {
  const { children, default: defaultValue, name, required, type } = props;
  const all = React.use(TypeTableContext);
  const [open, setOpen] = React.useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a row follows "Expand all" each time it is pressed.
  React.useEffect(() => {
    if (all.version > 0) {
      setOpen(all.open);
    }
  }, [all.version]);

  const label = (
    <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-1">
      <code className={cn(codeClassName, "font-medium text-site-foreground")}>
        {name}
        {required ? <span className="text-red-500">*</span> : null}
      </code>
      {type ? (
        <code
          className={cn(
            "min-w-0 max-w-full text-site-muted-foreground text-xs",
            open ? "whitespace-normal break-words" : "truncate"
          )}
        >
          {type}
        </code>
      ) : null}
    </span>
  );

  if (!hasDetails(props)) {
    return (
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2.5">
        {label}
        <span className="w-full text-site-muted-foreground text-sm sm:w-auto sm:flex-[2]">
          {children}
        </span>
      </div>
    );
  }

  return (
    <Collapsible onOpenChange={setOpen} open={open}>
      <CollapsibleTrigger className="group flex w-full items-start gap-2 px-3 py-2.5 text-left outline-none transition-colors hover:bg-site-muted/50 focus-visible:bg-site-muted/50">
        <CaretRightIcon
          aria-hidden="true"
          className="mt-1 size-3.5 shrink-0 text-site-muted-foreground transition-transform duration-150 group-data-[panel-open]:rotate-90 motion-reduce:transition-none"
        />
        {label}
        {defaultValue ? (
          <span className="shrink-0 text-site-muted-foreground text-xs">
            default <code className={codeClassName}>{defaultValue}</code>
          </span>
        ) : null}
      </CollapsibleTrigger>
      {children ? (
        <CollapsibleContent className="px-3 pb-3 ps-[2.125rem] text-site-muted-foreground text-sm leading-relaxed">
          {children}
        </CollapsibleContent>
      ) : null}
    </Collapsible>
  );
}
