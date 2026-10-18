import * as React from "react";
import { ComponentSource } from "@/components/code/source/component-source";
import { ComponentPreviewTabs } from "@/components/preview/component/component-preview-tabs";
import {
  ShowPartsArea,
  ShowPartsProvider,
  ShowPartsToggle,
} from "@/components/preview/component/show-parts";
import { PreviewLoading } from "@/components/preview/frame/preview-frame";
import { getPreviewHint } from "@/lib/docs/menu/preview-hint";
import { isBlock, isExpandable } from "@/lib/registry/catalog/is-block";
import { getRegistryComponent } from "@/lib/registry/core/registry";
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
    <ShowPartsProvider>
      <ComponentPreviewTabs
        actions={<ShowPartsToggle />}
        align={align}
        chromeLessOnMobile={chromeLessOnMobile}
        className={className}
        component={
          <React.Suspense fallback={<PreviewLoading />}>
            <ShowPartsArea>
              <Component />
            </ShowPartsArea>
          </React.Suspense>
        }
        expand={isExpandable(name)}
        fitContent={isBlock(name)}
        hideCode={hideCode}
        hint={getPreviewHint(name)}
        name={name}
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
    </ShowPartsProvider>
  );
}
