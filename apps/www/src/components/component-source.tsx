import fs from "node:fs/promises";
import path from "node:path";
import type * as React from "react";
import { CodeCollapsibleWrapper } from "@/components/code-collapsible-wrapper";
import { CopyButton } from "@/components/copy-button";
import { getIconForLanguageExtension } from "@/components/icons";
import { transformStyleClassNames } from "@/lib/code-utils";
import { highlightCode } from "@/lib/highlight-code";
import { getIconLibraryFromStyle, transformIcons } from "@/lib/icons";
import { cn } from "@/lib/utils";
import type { IconLibraryName } from "@/registry/config";

import { ComponentSourceClient } from "./component-source-client";

// Default styleName - matches the API default
const DEFAULT_STYLE_NAME = "base-nova";

const COLLAPSIBLE_COPY_BUTTON_CLASS_NAME =
  "pointer-events-none invisible opacity-0 transition-opacity group-data-open/collapsible:pointer-events-auto group-data-open/collapsible:visible group-data-open/collapsible:opacity-100";

export async function ComponentSource({
  name,
  src,
  title,
  language,
  collapsible = true,
  className,
  styleName = DEFAULT_STYLE_NAME,
  iconLibrary,
  maxLines,
  code: initialCode,
  async = false,
  eventName,
  showCopyButton = true,
}: React.ComponentProps<"div"> & {
  name?: string;
  src?: string;
  title?: string;
  language?: string;
  collapsible?: boolean;
  styleName?: string;
  iconLibrary?: IconLibraryName;
  maxLines?: number;
  code?: string;
  async?: boolean;
  eventName?: "copy_component_code";
  showCopyButton?: boolean;
}) {
  if (async) {
    return (
      <ComponentSourceClient
        className={className}
        code={initialCode}
        collapsible={collapsible}
        eventName={eventName}
        iconLibrary={iconLibrary}
        language={language}
        maxLines={maxLines}
        name={name}
        showCopyButton={showCopyButton}
        src={src}
        styleName={styleName}
        title={title}
      />
    );
  }

  let code = initialCode;

  if (code) {
    // Transform classNames for display (code prop comes raw, not from static JSON)
    code = transformStyleClassNames(code, styleName);

    // Transform icons for display if code is provided via prop (e.g. from rehype)
    const effectiveIconLibrary =
      iconLibrary ?? getIconLibraryFromStyle(styleName);
    code = transformIcons(code, effectiveIconLibrary);
  }

  if (!code && name) {
    // Read from pre-built static JSON (style classes already transformed at build time)
    try {
      const jsonPath = path.join(
        process.cwd(),
        "public",
        "r",
        "styles",
        styleName,
        `${name}.json`
      );
      const jsonContent = await fs.readFile(jsonPath, "utf-8");
      const item = JSON.parse(jsonContent);
      code = item?.files?.[0]?.content;
    } catch (error) {
      console.error(`Error reading static registry: ${name}`, error);
    }

    if (code) {
      // Transform icons for display (not baked into static JSON)
      const effectiveIconLibrary =
        iconLibrary ?? getIconLibraryFromStyle(styleName);
      code = transformIcons(code, effectiveIconLibrary);
    }
  }

  if (!code && src) {
    const projectRoot = process.cwd();
    let absolutePath: string;
    const REGISTRY_AUDIO_PREFIX = "registry-audio/";
    if (src.startsWith("registry/")) {
      absolutePath = path.join(projectRoot, "src/registry", src.slice(9));
    } else if (src.startsWith(REGISTRY_AUDIO_PREFIX)) {
      absolutePath = path.join(
        projectRoot,
        "src/registry-audio",
        src.slice(REGISTRY_AUDIO_PREFIX.length)
      );
    } else {
      absolutePath = path.join(projectRoot, src);
    }

    // Resolve and verify the path stays within the project directory
    const resolvedPath = path.resolve(absolutePath);
    if (
      !resolvedPath.startsWith(projectRoot + path.sep) &&
      resolvedPath !== projectRoot
    ) {
      console.error(`Path traversal blocked: ${src}`);
    } else {
      try {
        code = await fs.readFile(resolvedPath, "utf-8");

        // Transform classNames for display
        code = transformStyleClassNames(code, styleName);

        // Transform icons for file-based source
        const effectiveIconLibrary =
          iconLibrary ?? getIconLibraryFromStyle(styleName);
        code = transformIcons(code, effectiveIconLibrary);
      } catch (error) {
        console.error("Error reading source file", error);
      }
    }
  }

  if (!code) {
    return null;
  }

  // Clean up any remaining artifacts
  code = code.replaceAll("/* eslint-disable react/no-children-prop */\n", "");

  if (maxLines) {
    code = code.split("\n").slice(0, maxLines).join("\n");
  }

  const lang = language ?? title?.split(".").pop() ?? "tsx";
  const highlightedCode = await highlightCode(code, lang);

  const effectiveEventName = eventName ?? "copy_component_code";

  if (!collapsible) {
    return (
      <div className={cn("relative", className)}>
        <ComponentCode
          code={code}
          eventName={effectiveEventName}
          highlightedCode={highlightedCode}
          iconLibrary={iconLibrary}
          language={lang}
          name={name}
          showCopyButton={showCopyButton}
          styleName={styleName}
          title={title}
        />
      </div>
    );
  }

  return (
    <CodeCollapsibleWrapper className={className}>
      <ComponentCode
        code={code}
        copyButtonClassName={COLLAPSIBLE_COPY_BUTTON_CLASS_NAME}
        eventName={effectiveEventName}
        highlightedCode={highlightedCode}
        iconLibrary={iconLibrary}
        language={lang}
        name={name}
        showCopyButton={showCopyButton}
        styleName={styleName}
        title={title}
      />
    </CodeCollapsibleWrapper>
  );
}

function ComponentCode({
  code,
  highlightedCode,
  language,
  title,
  eventName,
  name,
  styleName,
  iconLibrary,
  showCopyButton,
  copyButtonClassName,
}: {
  code: string;
  highlightedCode: string;
  language: string;
  title: string | undefined;
  eventName?: string;
  name?: string;
  styleName?: string;
  iconLibrary?: string;
  showCopyButton?: boolean;
  copyButtonClassName?: string;
}) {
  return (
    <figure className="[&>pre]:max-h-96" data-rehype-pretty-code-figure="">
      {title && (
        <figcaption
          className="flex items-center gap-2 text-site-code-foreground [&_svg]:size-4 [&_svg]:text-site-code-foreground [&_svg]:opacity-70"
          data-language={language}
          data-rehype-pretty-code-title=""
        >
          {getIconForLanguageExtension(language)}
          {title}
        </figcaption>
      )}
      {showCopyButton && (
        <CopyButton
          className={copyButtonClassName}
          event={eventName as any}
          properties={{
            name,
            style: styleName,
            iconLibrary,
          }}
          value={code}
        />
      )}
      <div dangerouslySetInnerHTML={{ __html: highlightedCode }} />
    </figure>
  );
}
