import fs from "node:fs/promises";
import path from "node:path";
import type React from "react";
import { CodeBlock } from "@/components/md/block";
import { Collapse, CopyButton } from "@/components/md/code";
import { getRegistryItem } from "@/lib/registry";
import { Index } from "@/registry/__index__";
import { cn } from "@/registry/bases/base/lib/utils";
import { Button } from "@/registry/bases/base/ui/button";
import { CollapsibleTrigger } from "@/registry/bases/base/ui/collapsible";
import { Separator } from "@/registry/bases/base/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/registry/bases/base/ui/tabs";

// Source helpers

async function loadSourceCode(
  name?: string,
  src?: string
): Promise<{ code: string; inferredPathLabel: string } | null> {
  if (name) {
    const item = await getRegistryItem(name);
    const code = item?.files?.[0]?.content;
    const inferredPathLabel = item?.files?.[0]?.path ?? "";
    if (code) {
      return { code, inferredPathLabel };
    }
  }
  if (src) {
    const code = await fs.readFile(path.join(process.cwd(), src), "utf-8");
    return { code, inferredPathLabel: src };
  }
  return null;
}

function buildSourceActions({
  collapsible,
  copyButton,
  headerActions,
  code,
}: {
  collapsible: boolean;
  copyButton: boolean;
  headerActions?: React.ReactNode;
  code: string;
}): React.ReactNode {
  if (collapsible) {
    return (
      <span className="flex items-center gap-1">
        {headerActions}
        <CollapsibleTrigger render={<Button size="sm" variant="ghost" />}>
          <span className="group-data-open/collapsible:hidden">Expand</span>
          <span className="hidden group-data-open/collapsible:inline">
            Collapse
          </span>
        </CollapsibleTrigger>
        {copyButton ? (
          <Separator className="mx-0.5" orientation="vertical" />
        ) : null}
        {copyButton ? (
          <CopyButton size="icon-sm" value={code} variant="ghost" />
        ) : null}
      </span>
    );
  }
  if (headerActions !== undefined) {
    return headerActions;
  }
  if (!copyButton) {
    return null;
  }
  // returning nothing → CodeBlock renders its default CopyButton
}

// Source

async function Source({
  name,
  src,
  title,
  language,
  collapsible = true,
  className,
  fillHeight = false,
  pathLabel,
  showPath = true,
  headerActions,
  copyButton = true,
}: React.ComponentProps<"div"> & {
  name?: string;
  src?: string;
  title?: string;
  language?: string;
  collapsible?: boolean;
  fillHeight?: boolean;
  pathLabel?: string;
  /** Set to false to hide the inferred file path (e.g. in Preview tabs). */
  showPath?: boolean;
  headerActions?: React.ReactNode;
  copyButton?: boolean;
}) {
  if (!(name || src)) {
    return null;
  }

  const loaded = await loadSourceCode(name, src);
  if (!loaded) {
    return null;
  }

  const { code, inferredPathLabel } = loaded;
  const lang = language ?? title?.split(".").pop() ?? "tsx";
  const actions = buildSourceActions({
    collapsible,
    copyButton,
    headerActions,
    code,
  });

  const block = (
    <CodeBlock
      actions={actions}
      code={code}
      language={lang}
      pathLabel={showPath ? (pathLabel ?? inferredPathLabel) : pathLabel}
      title={title}
      variant={fillHeight ? "fill" : "default"}
    />
  );

  if (collapsible) {
    return <Collapse className={className}>{block}</Collapse>;
  }

  return (
    <div
      className={cn(
        fillHeight && "flex min-h-0 flex-1 flex-col",
        "relative",
        className
      )}
    >
      {block}
    </div>
  );
}

// PreviewTabs

function PreviewTabs({
  className,
  align = "center",
  hideCode = false,
  component,
  source,
  ...props
}: React.ComponentProps<"div"> & {
  align?: "center" | "start" | "end";
  hideCode?: boolean;
  component: React.ReactNode;
  source: React.ReactNode;
}) {
  return (
    <div
      className={cn("group relative mt-4 mb-12 flex flex-col", className)}
      {...props}
    >
      <Tabs defaultValue="preview">
        {!hideCode && (
          <TabsList>
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="code">Code</TabsTrigger>
          </TabsList>
        )}
        <TabsContent className="relative rounded-4xl border" value="preview">
          <div
            className={cn(
              "preview flex w-full justify-center overflow-y-auto p-10 data-[align=start]:items-start data-[align=end]:items-end data-[align=center]:items-center max-sm:px-6"
            )}
            data-align={align}
          >
            {component}
          </div>
        </TabsContent>
        <TabsContent
          className="relative rounded-none **:[figure]:m-0! **:[pre]:h-max **:[pre]:max-h-[450px]"
          value="code"
        >
          {source}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Preview

function Preview({
  name,
  className,
  align = "center",
  hideCode = false,
  ...props
}: Omit<React.ComponentProps<"div">, "ref"> & {
  name: string;
  align?: "center" | "start" | "end";
  description?: string;
  hideCode?: boolean;
}) {
  const Component = Index[name]?.component;

  if (!Component) {
    return (
      <p className="py-4 text-muted-foreground text-sm">
        Component{" "}
        <code className="relative rounded-4xl bg-muted px-[0.3rem] py-[0.2rem] font-mono text-destructive text-sm">
          {name}
        </code>{" "}
        not found.
      </p>
    );
  }

  return (
    <PreviewTabs
      align={align}
      className={className}
      component={<Component />}
      hideCode={hideCode}
      source={<Source collapsible={false} name={name} showPath={false} />}
      {...props}
    />
  );
}

export { Source, Preview, PreviewTabs };
