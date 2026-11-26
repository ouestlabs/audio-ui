import * as React from "react";
import { ComponentSource } from "@/components/code/source/component-source";
import { ComponentPreviewTabs } from "@/components/preview/component/component-preview-tabs";
import { PreviewLoading } from "@/components/preview/frame/preview-frame";
import {
  PlaygroundPreview,
  PlaygroundSource,
} from "@/components/preview/playground/playground-preview";
import { useSkin } from "@/hooks/use-skin";
import { useSkinAxes } from "@/hooks/use-skin-axes";
import { chosenAxes } from "@/lib/design-system/look";
import {
  isDevicePreview,
  isSkinnable,
  shadowSkin,
  skinFrameClass,
} from "@/lib/docs/content/skin-frame";
import { getPreviewHint } from "@/lib/docs/menu/preview-hint";
import {
  codeOf,
  type Framework,
  isPlayground,
} from "@/lib/docs/playground/playgrounds";
import { isBlock, isExpandable } from "@/lib/registry/catalog/is-block";
import { getRegistryComponent } from "@/lib/registry/core/registry";
import type { IconLibraryName } from "@/registry/config";

const DEMO_FRAMEWORK = /-(vue|svelte|web)-demo$/;

/** The framework a demo is written in, by its name: `knob-vue-demo` is Vue's, a name with none React's. */
const frameworkOfDemo = (name: string): Framework =>
  (DEMO_FRAMEWORK.exec(name)?.[1] as Framework | undefined) ?? "react";

/**
 * A component's preview as the customizer's Component tab sets it: the
 * element with the props chosen, in the framework the demo is written in, and
 * the code that writes it in the code panel.
 */
function PlaygroundComponentPreview({
  name,
  playground,
  ...props
}: Omit<
  React.ComponentProps<typeof ComponentPreviewTabs>,
  "component" | "source"
> & {
  playground: Parameters<typeof codeOf>[0];
}) {
  const framework = frameworkOfDemo(name);
  const { file } = codeOf(playground, framework, {});
  const source = React.useCallback(
    (onCode: (code: string) => void) => (
      <PlaygroundSource
        framework={framework}
        name={playground}
        onCode={onCode}
      />
    ),
    [framework, playground]
  );
  return (
    <ComponentPreviewTabs
      {...props}
      component={<PlaygroundPreview framework={framework} name={playground} />}
      file={file}
      name={name}
      source={source}
    />
  );
}

// Default styleName - matches the API default
const DEFAULT_STYLE_NAME = "ui-sdk-nova";

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
  playground,
  ...props
}: React.ComponentProps<"div"> & {
  name: string;
  /** Makes it the page's playground: the customizer's Component tab sets its props, and its code follows. */
  playground?: string;
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
  if (isPlayground(playground)) {
    return (
      <PlaygroundComponentPreview
        className={className}
        name={name}
        playground={playground}
        previewClassName={previewClassName}
        {...props}
      />
    );
  }
  return (
    <RegistryComponentPreview
      align={align}
      chromeLessOnMobile={chromeLessOnMobile}
      className={className}
      code={code}
      hideCode={hideCode}
      iconLibrary={iconLibrary}
      name={name}
      previewClassName={previewClassName}
      styleName={styleName}
      type={type}
      {...props}
    />
  );
}

/**
 * The demo in the skin the reader chose. A device's block wears it as it is;
 * an element's demo stands on the skin's plate, in React on the page and in
 * another framework in its shadow root, with the skin's sheet.
 */
function Skinned({
  Component,
  name,
}: {
  Component: React.ComponentType<{ skin?: ReturnType<typeof shadowSkin> }>;
  name: string;
}) {
  const [skin] = useSkin();
  const { values } = useSkinAxes();
  if (skin === "digital") {
    return <Component />;
  }
  if (isDevicePreview(name)) {
    return (
      <div className={`skin-${skin} contents`}>
        <Component />
      </div>
    );
  }
  if (!isSkinnable(name)) {
    return <Component />;
  }
  if (frameworkOfDemo(name) !== "react") {
    return <Component skin={shadowSkin(skin, chosenAxes(values), name)} />;
  }
  return (
    <div className={skinFrameClass(skin, name)}>
      <Component />
    </div>
  );
}

/** A preview of a registry item: its demo, in the skin chosen, and its source. */
function RegistryComponentPreview({
  name,
  type: _type,
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
          <Skinned Component={Component} name={name} />
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
