import fs from "node:fs/promises";
import path from "node:path";
import type * as React from "react";
import { CodeCollapsibleWrapper } from "@/components/code-collapsible-wrapper";
import { CopyButton } from "@/components/copy-button";
import { HighlightedCode } from "@/components/highlighted-code";
import { getIconForLanguageExtension } from "@/components/icons";
import { transformStyleClassNames } from "@/lib/code-utils";
import { getIconLibraryFromStyle, transformIcons } from "@/lib/icons";
import { cn } from "@/lib/utils";
import type { IconLibraryName } from "@/registry/config";

import { ComponentSourceClient } from "./component-source-client";

// Default styleName - matches the API default
const DEFAULT_STYLE_NAME = "base-nova";

const COLLAPSIBLE_COPY_BUTTON_CLASS_NAME =
  "pointer-events-none invisible opacity-0 transition-opacity group-data-open/collapsible:pointer-events-auto group-data-open/collapsible:visible group-data-open/collapsible:opacity-100";

/** The code of a registry item, from the JSON the registry build wrote for the style. */
async function readRegistryItemCode(name: string, styleName: string) {
  try {
    const jsonPath = path.join(
      process.cwd(),
      "public",
      "r",
      "styles",
      styleName,
      `${name}.json`
    );
    const item = JSON.parse(await fs.readFile(jsonPath, "utf-8"));
    return item?.files?.[0]?.content as string | undefined;
  } catch (error) {
    console.error(`Error reading static registry: ${name}`, error);
  }
}

const REGISTRY_AUDIO_PREFIX = "registry-audio/";

/** A file of the project, by a path relative to it; a path that leaves the project reads nothing. */
async function readProjectFile(src: string) {
  const projectRoot = process.cwd();
  let absolutePath: string;
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

  const resolvedPath = path.resolve(absolutePath);
  if (
    !resolvedPath.startsWith(projectRoot + path.sep) &&
    resolvedPath !== projectRoot
  ) {
    console.error(`Path traversal blocked: ${src}`);
    return;
  }
  try {
    return await fs.readFile(resolvedPath, "utf-8");
  } catch (error) {
    console.error("Error reading source file", error);
  }
}

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

  const effectiveIconLibrary =
    iconLibrary ?? getIconLibraryFromStyle(styleName);
  let code: string | undefined;
  if (initialCode) {
    // The code prop comes raw, not from the static JSON.
    code = transformIcons(
      transformStyleClassNames(initialCode, styleName),
      effectiveIconLibrary
    );
  } else if (name) {
    // The static JSON has the style's classes already: only the icons are left to swap.
    const itemCode = await readRegistryItemCode(name, styleName);
    code = itemCode && transformIcons(itemCode, effectiveIconLibrary);
  }
  if (!code && src) {
    const fileCode = await readProjectFile(src);
    code =
      fileCode &&
      transformIcons(
        transformStyleClassNames(fileCode, styleName),
        effectiveIconLibrary
      );
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

  const effectiveEventName = eventName ?? "copy_component_code";

  if (!collapsible) {
    return (
      <div className={cn("relative", className)}>
        <ComponentCode
          code={code}
          eventName={effectiveEventName}
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
            iconLibrary,
            name,
            style: styleName,
          }}
          value={code}
        />
      ) : null}
      <HighlightedCode code={code} language={language} />
    </figure>
  );
}
