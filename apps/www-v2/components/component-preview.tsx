import type * as React from "react";
import { ComponentClient } from "@/components/component-client";
import { ComponentPreviewTabs } from "@/components/component-preview-tabs";
import { ComponentSource } from "@/components/component-source";
import { getRegistryComponent } from "@/lib/registry";
import type { IconLibraryName } from "@/registry/config";

// Default styleName - matches the API default
const DEFAULT_STYLE_NAME = "base-nova";

export function ComponentPreview({
  name,
  type,
  className,
  previewClassName,
  align = "center",
  hideCode = false,
  chromeLessOnMobile = false,
  styleName = DEFAULT_STYLE_NAME,
  iconLibrary,
  code,
  ...props
}: React.ComponentProps<"div"> & {
  name: string;
  styleName?: string;
  iconLibrary?: IconLibraryName;
  align?: "center" | "start" | "end";
  description?: string;
  hideCode?: boolean;
  type?: "block" | "component" | "example";
  chromeLessOnMobile?: boolean;
  previewClassName?: string;
  code?: string;
}) {
  const Component = getRegistryComponent(name, styleName);

  if (!Component) {
    return (
      <p className="mt-6 text-site-muted-foreground text-sm">
        Component{" "}
        <code className="site-rounded-sm relative bg-site-muted px-[0.3rem] py-[0.2rem] font-mono text-sm">
          {name}
        </code>{" "}
        not found in registry.
      </p>
    );
  }

  return (
    <ComponentPreviewTabs
      align={align}
      chromeLessOnMobile={chromeLessOnMobile}
      className={className}
      component={<ComponentClient name={name} styleName={styleName} />}
      hideCode={hideCode}
      previewClassName={previewClassName}
      source={
        <ComponentSource
          code={code}
          collapsible={false}
          iconLibrary={iconLibrary}
          name={name}
          showCopyButton
          styleName={styleName}
        />
      }
      sourcePreview={
        <ComponentSource
          code={code}
          collapsible={false}
          iconLibrary={iconLibrary}
          maxLines={3}
          name={name}
          showCopyButton={false}
          styleName={styleName}
        />
      }
      {...props}
    />
  );
}
