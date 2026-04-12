import fs from "node:fs/promises";
import path from "node:path";
import type React from "react";
import { CodeBlock } from "@/components/md/block";
import { Collapse } from "@/components/md/code";
import { getRegistryItem } from "@/lib/registry";
import { Index } from "@/registry/__index__";
import { cn } from "@/registry/default/lib/utils";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/registry/default/ui/tabs";

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
  headerActions?: React.ReactNode;
  copyButton?: boolean;
}) {
  if (!(name || src)) {
    return null;
  }

  let code: string | undefined;

  if (name) {
    const item = await getRegistryItem(name);
    code = item?.files?.[0]?.content;
  }

  if (src) {
    const file = await fs.readFile(path.join(process.cwd(), src), "utf-8");
    code = file;
  }

  if (!code) {
    return null;
  }

  const lang = language ?? title?.split(".").pop() ?? "tsx";

  if (!collapsible) {
    return (
      <div
        className={cn(
          fillHeight && "flex min-h-0 flex-1 flex-col",
          "relative",
          className
        )}
      >
        <CodeBlock
          code={code}
          copyButton={copyButton}
          fillHeight={fillHeight}
          headerActions={headerActions}
          language={lang}
          pathLabel={pathLabel}
          title={title}
        />
      </div>
    );
  }

  return (
    <Collapse className={className}>
      <CodeBlock
        code={code}
        copyButton={copyButton}
        fillHeight={fillHeight}
        headerActions={headerActions}
        language={lang}
        pathLabel={pathLabel}
        title={title}
      />
    </Collapse>
  );
}

// Preview Tabs
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
      className={cn("group relative mt-4 mb-12 flex flex-col gap-2", className)}
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
          className="relative rounded-none **:[figure]:m-0! **:[pre]:h-[450px]"
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
      source={<Source collapsible={false} name={name} />}
      {...props}
    />
  );
}

export { Source, Preview, PreviewTabs };
