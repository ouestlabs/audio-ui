"use client";

import * as React from "react";
import { CodeCollapsibleWrapper } from "@/components/code-collapsible-wrapper";
import { CopyButton } from "@/components/copy-button";
import { HighlightedCode } from "@/components/highlighted-code";
import { getIconForLanguageExtension } from "@/components/icons";
import { Spinner } from "@/components/ui/spinner";
import { useConfig } from "@/hooks/use-config";
import { transformStyleClassNames } from "@/lib/code-utils";
import { getIconLibraryFromStyle, transformIcons } from "@/lib/icons";
import { getRegistryDeploymentId, getRegistryJsonUrl } from "@/lib/registry";
import { cn } from "@/lib/utils";
import type { IconLibraryName } from "@/registry/config";

const DEFAULT_STYLE_NAME = "base-nova";

const COLLAPSIBLE_COPY_BUTTON_CLASS_NAME =
  "pointer-events-none invisible opacity-0 transition-opacity group-data-open/collapsible:pointer-events-auto group-data-open/collapsible:visible group-data-open/collapsible:opacity-100";

const clientCodeCache = new Map<string, string>();

export interface ComponentSourceClientProps {
  className?: string;
  code?: string;
  collapsible?: boolean;
  eventName?: "copy_component_code";
  /** Which file of the registry item to show, when it installs several. @default 0 */
  file?: number;
  iconLibrary?: IconLibraryName;
  language?: string;
  maxLines?: number;
  name?: string;
  showCopyButton?: boolean;
  src?: string;
  styleName?: string;
  title?: string;
}

export function ComponentSourceClient({
  name,
  src,
  file = 0,
  title,
  language,
  collapsible = true,
  className,
  styleName = DEFAULT_STYLE_NAME,
  iconLibrary: _iconLibrary,
  maxLines,
  code: initialCode,
  eventName,
  showCopyButton = true,
}: React.ComponentProps<"div"> & ComponentSourceClientProps) {
  const [config] = useConfig();

  // The code to show, once it is transformed for the style: nothing shows before.
  const [code, setCode] = React.useState<string | undefined>();
  const [isLoading, setIsLoading] = React.useState(!initialCode);

  const abortControllerRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    let isMounted = true;

    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: sequential fetch/cache/transform/highlight pipeline with layered fallbacks; splitting it would obscure the loading flow
    async function loadCode() {
      // Abort any previous request
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      setIsLoading(true);
      let currentCode = initialCode;

      if (name) {
        if (styleName.includes("undefined")) {
          return;
        }

        const cacheKey = `${getRegistryDeploymentId()}:${styleName}:${name}:${file}`;

        if (clientCodeCache.has(cacheKey)) {
          currentCode = clientCodeCache.get(cacheKey);
        } else {
          try {
            const url = getRegistryJsonUrl(styleName, name);
            const res = await fetch(url, {
              signal: abortControllerRef.current.signal,
            });

            if (res.ok) {
              const data = (await res.json()) as {
                files?: { content?: string }[];
              };
              currentCode = data.files?.[file]?.content;
              if (currentCode) {
                clientCodeCache.set(cacheKey, currentCode);
              }
            }
          } catch (error) {
            if (error instanceof Error && error.name === "AbortError") {
              return;
            }
            console.error("Error fetching registry item:", error);
          }
        }
      }

      if (!isMounted) {
        return;
      }

      if (!currentCode && src) {
        console.warn("src prop is not supported in client component");
      }

      if (!isMounted) {
        return;
      }

      if (currentCode) {
        currentCode = currentCode.replaceAll(
          "/* eslint-disable react/no-children-prop */\n",
          ""
        );

        currentCode = transformStyleClassNames(currentCode, styleName);
        const effectiveIconLibrary =
          _iconLibrary ?? getIconLibraryFromStyle(styleName);
        currentCode = transformIcons(currentCode, effectiveIconLibrary);

        if (maxLines) {
          currentCode = currentCode.split("\n").slice(0, maxLines).join("\n");
        }

        if (!isMounted) {
          return;
        }

        setCode(currentCode);
      }
      setIsLoading(false);
    }

    loadCode();

    return () => {
      isMounted = false;
      abortControllerRef.current?.abort();
    };
  }, [name, src, file, initialCode, styleName, _iconLibrary, maxLines]);

  if (isLoading) {
    return (
      <div
        className={cn("flex min-h-24 items-center justify-center", className)}
      >
        <Spinner className="size-4 opacity-60" />
      </div>
    );
  }

  if (!code) {
    return null;
  }

  const lang = language ?? title?.split(".").pop() ?? "tsx";

  const effectiveEventName = eventName ?? "copy_component_code";

  if (!collapsible) {
    return (
      <div className={cn("relative", className)}>
        <ComponentCode
          code={code}
          config={config}
          eventName={effectiveEventName}
          language={lang}
          name={name}
          showCopyButton={showCopyButton}
          title={title}
        />
      </div>
    );
  }

  return (
    <CodeCollapsibleWrapper className={className}>
      <ComponentCode
        code={code}
        config={config}
        copyButtonClassName={COLLAPSIBLE_COPY_BUTTON_CLASS_NAME}
        eventName={effectiveEventName}
        language={lang}
        name={name}
        showCopyButton={showCopyButton}
        title={title}
      />
    </CodeCollapsibleWrapper>
  );
}

function ComponentCode({
  code,
  language,
  title,
  eventName,
  name,
  config,
  showCopyButton,
  copyButtonClassName,
}: {
  code: string;
  language: string;
  title: string | undefined;
  eventName?: string;
  name?: string;
  config?: any;
  showCopyButton?: boolean;
  copyButtonClassName?: string;
}) {
  return (
    <figure data-rehype-pretty-code-figure="">
      {title ? (
        <figcaption
          className="flex items-center gap-2 text-site-code-foreground [&_svg]:size-4 [&_svg]:text-site-code-foreground [&_svg]:opacity-70"
          data-language={language}
          data-rehype-pretty-code-title=""
        >
          {getIconForLanguageExtension(language)}
          {title}
        </figcaption>
      ) : null}
      {showCopyButton ? (
        <CopyButton
          className={copyButtonClassName}
          event={eventName as any}
          properties={{
            base: config?.base,
            iconLibrary: config?.iconLibrary,
            name,
            style: config?.style,
          }}
          value={code}
        />
      ) : null}
      <HighlightedCode code={code} language={language} />
    </figure>
  );
}
