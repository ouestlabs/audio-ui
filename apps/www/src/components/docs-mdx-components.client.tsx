"use client";

import * as React from "react";
import { ComponentClient } from "@/components/component-client";
import { ComponentPreviewTabs } from "@/components/component-preview-tabs";
import {
  ComponentSourceClient,
  type ComponentSourceClientProps,
} from "@/components/component-source-client";
import { useConfig } from "@/hooks/use-config";
import {
  getSelectedRegistryStyleName,
  resolveRegistryIconLibrary,
} from "@/lib/docs-registry-options";
import { getRegistryComponent } from "@/lib/registry";
import type { IconLibraryName } from "@/registry/config";

type DocsComponentPreviewProps = React.ComponentProps<"div"> & {
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
};

function useResolvedRegistryOptions(
  initialStyleName: string,
  initialIconLibrary: IconLibraryName
) {
  const [config] = useConfig();
  const [hasStoredConfig, setHasStoredConfig] = React.useState(false);

  React.useEffect(() => {
    setHasStoredConfig(window.localStorage.getItem("config") !== null);
  }, []);

  const resolvedStyleName = React.useMemo(
    () =>
      hasStoredConfig
        ? getSelectedRegistryStyleName(config.base, config.style)
        : initialStyleName,
    [config.base, config.style, hasStoredConfig, initialStyleName]
  );

  const resolvedIconLibrary = React.useMemo(
    () =>
      hasStoredConfig
        ? resolveRegistryIconLibrary(config.iconLibrary, resolvedStyleName)
        : initialIconLibrary,
    [config.iconLibrary, hasStoredConfig, initialIconLibrary, resolvedStyleName]
  );

  return { resolvedStyleName, resolvedIconLibrary };
}

export function DocsComponentSourceSwitch({
  children,
  initialStyleName,
  initialIconLibrary,
  src,
  ...props
}: React.ComponentProps<"div"> &
  ComponentSourceClientProps & {
    children: React.ReactNode;
    initialStyleName: string;
    initialIconLibrary: IconLibraryName;
  }) {
  const { resolvedStyleName, resolvedIconLibrary } = useResolvedRegistryOptions(
    initialStyleName,
    initialIconLibrary
  );

  if (
    src ||
    (resolvedStyleName === initialStyleName &&
      resolvedIconLibrary === initialIconLibrary)
  ) {
    return <>{children}</>;
  }

  return (
    <ComponentSourceClient
      {...props}
      iconLibrary={resolvedIconLibrary}
      src={src}
      styleName={resolvedStyleName}
    />
  );
}

export function DocsComponentPreviewSwitch({
  children,
  initialStyleName,
  initialIconLibrary,
  name,
  styleName: _styleName,
  iconLibrary: _iconLibrary,
  type: _type,
  description: _description,
  className,
  previewClassName,
  align = "center",
  hideCode = false,
  chromeLessOnMobile = false,
  code,
  ...props
}: DocsComponentPreviewProps & {
  children: React.ReactNode;
  initialStyleName: string;
  initialIconLibrary: IconLibraryName;
}) {
  const { resolvedStyleName, resolvedIconLibrary } = useResolvedRegistryOptions(
    initialStyleName,
    initialIconLibrary
  );

  const Component = React.useMemo(
    () => getRegistryComponent(name, resolvedStyleName),
    [name, resolvedStyleName]
  );

  if (
    resolvedStyleName === initialStyleName &&
    resolvedIconLibrary === initialIconLibrary
  ) {
    return <>{children}</>;
  }

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
      component={<ComponentClient name={name} styleName={resolvedStyleName} />}
      hideCode={hideCode}
      previewClassName={previewClassName}
      source={
        <ComponentSourceClient
          code={code}
          collapsible={false}
          iconLibrary={resolvedIconLibrary}
          name={name}
          showCopyButton
          styleName={resolvedStyleName}
        />
      }
      sourcePreview={
        <ComponentSourceClient
          code={code}
          collapsible={false}
          iconLibrary={resolvedIconLibrary}
          maxLines={3}
          name={name}
          showCopyButton={false}
          styleName={resolvedStyleName}
        />
      }
      {...props}
    />
  );
}
