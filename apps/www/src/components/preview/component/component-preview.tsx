import * as React from "react";
import { ComponentSource } from "@/components/code/source/component-source";
import { ComponentPreviewTabs } from "@/components/preview/component/component-preview-tabs";
import { PreviewLoading } from "@/components/preview/frame/preview-frame";
import { type SkinId, useSkin } from "@/hooks/use-skin";
import { isDevicePreview, skinnedDemo } from "@/lib/docs/content/skinned-demos";
import { getPreviewHint } from "@/lib/docs/menu/preview-hint";
import { isBlock, isExpandable } from "@/lib/registry/catalog/is-block";
import { getRegistryComponent } from "@/lib/registry/core/registry";
import { HardwareSkin } from "@/registry/bases/shared/audio-ui/skins/hardware/skin";
import type { IconLibraryName } from "@/registry/config";

/** A device's block in the skin chosen: it wears the skin as it is. */
function DeviceSkin({
  children,
  skin,
}: {
  children: React.ReactNode;
  skin: SkinId;
}) {
  if (skin === "hardware") {
    return <HardwareSkin className="contents">{children}</HardwareSkin>;
  }
  if (skin === "neu") {
    return <div className="skin-neu contents">{children}</div>;
  }
  return children;
}

// Default styleName - matches the API default
const DEFAULT_STYLE_NAME = "ui-sdk-nova";

export function ComponentPreview({
  name: digitalName,
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
  const [skin] = useSkin();
  // The preview and its code both follow the skin.
  const name = skinnedDemo(skin, digitalName);
  const Component = getRegistryComponent(name, styleName);
  // The code without its own copy button: the panel's bar copies it.
  const source = React.useCallback(
    (onCode: (code: string) => void) => (
      <ComponentSource
        code={code}
        iconLibrary={iconLibrary}
        name={name}
        onCode={onCode}
        showCopyButton={false}
        styleName={styleName}
      />
    ),
    [code, iconLibrary, name, styleName]
  );

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
      component={
        <React.Suspense fallback={<PreviewLoading />}>
          {isDevicePreview(name) ? (
            <DeviceSkin skin={skin}>
              <Component />
            </DeviceSkin>
          ) : (
            <Component />
          )}
        </React.Suspense>
      }
      expand={isExpandable(name)}
      fitContent={isBlock(name)}
      hideCode={hideCode}
      hint={getPreviewHint(name)}
      name={name}
      previewClassName={previewClassName}
      source={source}
      {...props}
    />
  );
}
