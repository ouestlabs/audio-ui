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
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

/*
 * Reference tables: the frame of the site, a header, and rows. They are
 * `not-typeset`, so the page's Markdown styles (paragraph margins, inline
 * code, tables) do not reach them, and they set what they need themselves.
 */

/** What the text a row holds looks like: links, inline code and keys, in the table's own terms. */
const textClassName =
  "text-site-muted-foreground text-sm leading-relaxed [&_a]:text-site-foreground [&_a]:underline [&_a]:underline-offset-4 [&_code]:rounded-md [&_code]:bg-site-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.8125rem] [&_code]:text-site-foreground";

const codeClassName =
  "rounded-md bg-site-muted px-1.5 py-0.5 font-mono text-[0.8125rem]";

function ReferenceFrame({
  action,
  children,
  className,
  count,
  title,
}: {
  /** Something to do with the whole table, at the end of its header. */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  count: number;
  title: string;
}) {
  return (
    <Frame className={cn("not-typeset my-6", className)} data-slot="type-table">
      <FrameHeader className="min-h-11 flex-row items-center justify-between gap-3 px-2 py-1.5">
        <p className="ps-1 font-mono text-site-muted-foreground text-xs">
          {title} <span className="opacity-60">· {count}</span>
        </p>
        {action}
      </FrameHeader>
      <FrameContent className="divide-y divide-site-border">
        {children}
      </FrameContent>
    </Frame>
  );
}

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
 * A reference table: a row per prop that opens to show what it takes and what
 * it does. "Expand all" opens every row. Rows without a type or a default,
 * such as data attributes, say everything on one line.
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
    <ReferenceFrame
      action={
        collapsible ? (
          <Button onClick={toggleAll} size="sm" type="button" variant="outline">
            {state.open ? "Collapse all" : "Expand all"}
          </Button>
        ) : null
      }
      className={className}
      count={rows.length}
      title={title}
    >
      <TypeTableContext value={state}>{children}</TypeTableContext>
    </ReferenceFrame>
  );
}

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
            "min-w-0 max-w-full font-mono text-site-muted-foreground text-xs",
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
      <div className="grid gap-1 px-3 py-2.5 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-4">
        {label}
        <div className={textClassName}>{children}</div>
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
        <CollapsibleContent
          className={cn("px-3 pb-3 ps-[2.125rem]", textClassName)}
        >
          {children}
        </CollapsibleContent>
      ) : null}
    </Collapsible>
  );
}

/** A gesture, written with its keys between backticks: "`Alt` + drag a note". */
function Gesture({ value }: { value: string }) {
  return (
    <span className="flex flex-wrap items-center gap-y-1 text-site-foreground text-sm">
      {value.split("`").map((part, index) =>
        // Odd parts sit between backticks: those are keys.
        index % 2 === 1 ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: the parts of a fixed string.
          <Kbd key={index}>{part}</Kbd>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: the parts of a fixed string.
          <span className="whitespace-pre-wrap px-0.5" key={index}>
            {part}
          </span>
        )
      )}
    </span>
  );
}

/** A table of what a pointer or a keyboard does: a row per gesture, the keys drawn as keys. */
export function KeyTable({
  children,
  className,
  title = "Gestures",
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <ReferenceFrame
      className={className}
      count={React.Children.count(children)}
      title={title}
    >
      {children}
    </ReferenceFrame>
  );
}

/** One gesture of a `KeyTable`, and what it does in the children. */
export function KeyRow({
  children,
  gesture,
}: {
  children?: React.ReactNode;
  gesture: string;
}) {
  return (
    <div className="grid gap-1 px-3 py-2.5 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-4">
      <Gesture value={gesture} />
      <div className={textClassName}>{children}</div>
    </div>
  );
}
