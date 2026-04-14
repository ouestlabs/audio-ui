"use client";

import template from "lodash/template";
import React from "react";
import {
  CodeFrame,
  CodeFrameHeader,
  CodeFrameScroll,
  CopyButton,
} from "@/components/md/code";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { Icons } from "@/lib/icons";
import {
  type BaseColor,
  baseColors,
  baseColorsOKLCH,
} from "@/registry/base-colors";
import { TabsContent } from "@/registry/default/ui/tabs";

type BaseColorOKLCH = {
  light: Record<string, string>;
  dark: Record<string, string>;
};

const V3_SEMANTIC = [
  "card",
  "popover",
  "primary",
  "secondary",
  "muted",
  "accent",
  "destructive",
] as const;

const V3_CHARTS = [
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
] as const;

function ColorIndicator({ color }: { color: string }) {
  return (
    <span
      className="inline-block size-3 rounded-sm ring-1 ring-border/40"
      style={{ backgroundColor: color }}
    />
  );
}

type ThemeCodeBlockProps = {
  copied: boolean;
  onCopy: () => void;
  children: React.ReactNode;
};

function ThemeCodeBlock({ copied, onCopy, children }: ThemeCodeBlockProps) {
  return (
    <CodeFrame className="mx-0 mt-0" data-has-metadata data-variant="fill">
      <CodeFrameHeader
        actions={
          <CopyButton
            copied={copied}
            onAction={onCopy}
            size="icon-sm"
            variant="ghost"
          />
        }
        icon={<Icons.css aria-hidden className="fill-foreground" />}
        language="css"
        pathLabel="app/globals.css"
      />
      <CodeFrameScroll>
        <pre className="font-mono leading-relaxed">
          <code data- data-language="css" data-line-numbers>
            {children}
          </code>
        </pre>
      </CodeFrameScroll>
    </CodeFrame>
  );
}

function OklchTabContent({
  activeThemeOKLCH,
  hasCopied,
  copyToClipboard,
}: {
  activeThemeOKLCH: BaseColorOKLCH | undefined;
  hasCopied: boolean;
  copyToClipboard: (text: string) => void;
}) {
  return (
    <TabsContent
      className="flex min-h-0 min-w-0 flex-1 flex-col"
      value="v4-oklch"
    >
      <ThemeCodeBlock
        copied={hasCopied}
        onCopy={() => {
          copyToClipboard(getThemeCodeOKLCH(activeThemeOKLCH, 0.65));
        }}
      >
        <span className="line text-code-foreground" data-line>
          &nbsp;:root &#123;
        </span>
        <span className="line text-code-foreground" data-line>
          &nbsp;&nbsp;&nbsp;--radius: 0.65rem;
        </span>
        {Object.entries(activeThemeOKLCH?.light ?? {}).map(([key, value]) => (
          <span className="line text-code-foreground" data-line key={key}>
            &nbsp;&nbsp;&nbsp;--{key}: <ColorIndicator color={value} /> {value}
          </span>
        ))}
        <span className="line text-code-foreground" data-line>
          &nbsp;&#125;
        </span>
        <span className="line text-code-foreground" data-line>
          &nbsp;
        </span>
        <span className="line text-code-foreground" data-line>
          &nbsp;.dark &#123;
        </span>
        {Object.entries(activeThemeOKLCH?.dark ?? {}).map(([key, value]) => (
          <span className="line text-code-foreground" data-line key={key}>
            &nbsp;&nbsp;&nbsp;--{key}: <ColorIndicator color={value} /> {value}
          </span>
        ))}
        <span className="line text-code-foreground" data-line>
          &nbsp;&#125;
        </span>
      </ThemeCodeBlock>
    </TabsContent>
  );
}

function HslTabContent({
  activeTheme,
  hasCopied,
  copyToClipboard,
}: {
  activeTheme: BaseColor | undefined;
  hasCopied: boolean;
  copyToClipboard: (text: string) => void;
}) {
  const light = activeTheme?.cssVars.light ?? {};
  const dark = activeTheme?.cssVars.dark ?? {};

  return (
    <TabsContent
      className="flex min-h-0 min-w-0 flex-1 flex-col"
      value="v4-hsl"
    >
      <ThemeCodeBlock
        copied={hasCopied}
        onCopy={() => {
          copyToClipboard(getThemeCodeHSLV4(activeTheme, 0.65));
        }}
      >
        <span className="line text-code-foreground" data-line>
          &nbsp;:root &#123;
        </span>
        <span className="line text-code-foreground" data-line>
          &nbsp;&nbsp;&nbsp;--radius: 0.65rem;
        </span>
        {Object.entries(light).map(([key, value]) => {
          const v = String(value);
          return (
            <span className="line text-code-foreground" data-line key={key}>
              &nbsp;&nbsp;&nbsp;--{key}: <ColorIndicator color={`hsl(${v})`} />{" "}
              hsl({v});
            </span>
          );
        })}
        <span className="line text-code-foreground" data-line>
          &nbsp;&#125;
        </span>
        <span className="line text-code-foreground" data-line>
          &nbsp;
        </span>
        <span className="line text-code-foreground" data-line>
          &nbsp;.dark &#123;
        </span>
        {Object.entries(dark).map(([key, value]) => {
          const v = String(value);
          return (
            <span className="line text-code-foreground" data-line key={key}>
              &nbsp;&nbsp;&nbsp;--{key}: <ColorIndicator color={`hsl(${v})`} />{" "}
              hsl({v});
            </span>
          );
        })}
        <span className="line text-code-foreground" data-line>
          &nbsp;&#125;
        </span>
      </ThemeCodeBlock>
    </TabsContent>
  );
}

function V3SemanticLines({
  vars,
  indent,
}: {
  vars: BaseColor["cssVars"]["light"] | BaseColor["cssVars"]["dark"];
  indent: string;
}) {
  return (
    <>
      {V3_SEMANTIC.map((prefix) => (
        <React.Fragment key={prefix}>
          <span className="line text-code-foreground" data-line>
            {indent}--{prefix}:{" "}
            <ColorIndicator color={`hsl(${String(vars[prefix])})`} />{" "}
            {String(vars[prefix])}
          </span>
          <span className="line text-code-foreground" data-line>
            {indent}--{prefix}-foreground:{" "}
            <ColorIndicator
              color={`hsl(${String(vars[`${prefix}-foreground` as keyof typeof vars])})`}
            />{" "}
            {String(vars[`${prefix}-foreground` as keyof typeof vars])}
          </span>
        </React.Fragment>
      ))}
    </>
  );
}

function V3ChartLines({
  vars,
  indent,
}: {
  vars: BaseColor["cssVars"]["light"] | BaseColor["cssVars"]["dark"];
  indent: string;
}) {
  return (
    <>
      {V3_CHARTS.map((prefix) => (
        <span className="line text-code-foreground" data-line key={prefix}>
          {indent}--{prefix}:{" "}
          <ColorIndicator color={`hsl(${String(vars[prefix])})`} />{" "}
          {String(vars[prefix])}
        </span>
      ))}
    </>
  );
}

function V3TabContent({
  activeTheme,
  hasCopied,
  copyToClipboard,
}: {
  activeTheme: BaseColor | undefined;
  hasCopied: boolean;
  copyToClipboard: (text: string) => void;
}) {
  const light = activeTheme?.cssVars.light;
  const dark = activeTheme?.cssVars.dark;
  const indent4 = "\u00a0\u00a0\u00a0\u00a0";
  const indent2 = "\u00a0\u00a0";

  return (
    <TabsContent className="flex min-h-0 min-w-0 flex-1 flex-col" value="v3">
      <ThemeCodeBlock
        copied={hasCopied}
        onCopy={() => {
          copyToClipboard(getThemeCode(activeTheme, 0.5));
        }}
      >
        <span className="line text-code-foreground" data-line>
          @layer base &#123;
        </span>
        <span className="line text-code-foreground" data-line>
          {indent2}:root &#123;
        </span>
        {light ? (
          <>
            <span className="line text-code-foreground" data-line>
              {indent4}--background:{" "}
              <ColorIndicator color={`hsl(${light.background})`} />{" "}
              {light.background}
            </span>
            <span className="line text-code-foreground" data-line>
              {indent4}--foreground:{" "}
              <ColorIndicator color={`hsl(${light.foreground})`} />{" "}
              {light.foreground}
            </span>
            <V3SemanticLines indent={indent4} vars={light} />
            <span className="line text-code-foreground" data-line>
              {indent4}--border:{" "}
              <ColorIndicator color={`hsl(${light.border})`} /> {light.border}
            </span>
            <span className="line text-code-foreground" data-line>
              {indent4}--input: <ColorIndicator color={`hsl(${light.input})`} />{" "}
              {light.input}
            </span>
            <span className="line text-code-foreground" data-line>
              {indent4}--ring: <ColorIndicator color={`hsl(${light.ring})`} />{" "}
              {light.ring}
            </span>
            <span className="line text-code-foreground" data-line>
              {indent4}--radius: 0.5rem;
            </span>
            <V3ChartLines indent={indent4} vars={light} />
          </>
        ) : null}
        <span className="line text-code-foreground" data-line>
          {indent2}&#125;
        </span>
        <span className="line text-code-foreground" data-line>
          &nbsp;
        </span>
        <span className="line text-code-foreground" data-line>
          {indent2}.dark &#123;
        </span>
        {dark ? (
          <>
            <span className="line text-code-foreground" data-line>
              {indent4}--background:{" "}
              <ColorIndicator color={`hsl(${dark.background})`} />{" "}
              {dark.background}
            </span>
            <span className="line text-code-foreground" data-line>
              {indent4}--foreground:{" "}
              <ColorIndicator color={`hsl(${dark.foreground})`} />{" "}
              {dark.foreground}
            </span>
            <V3SemanticLines indent={indent4} vars={dark} />
            <span className="line text-code-foreground" data-line>
              {indent4}--border:{" "}
              <ColorIndicator color={`hsl(${dark.border})`} /> {dark.border}
            </span>
            <span className="line text-code-foreground" data-line>
              {indent4}--input: <ColorIndicator color={`hsl(${dark.input})`} />{" "}
              {dark.input}
            </span>
            <span className="line text-code-foreground" data-line>
              {indent4}--ring: <ColorIndicator color={`hsl(${dark.ring})`} />{" "}
              {dark.ring}
            </span>
            <V3ChartLines indent={indent4} vars={dark} />
          </>
        ) : null}
        <span className="line text-code-foreground" data-line>
          {indent2}&#125;
        </span>
        <span className="line text-code-foreground" data-line>
          &#125;
        </span>
      </ThemeCodeBlock>
    </TabsContent>
  );
}

export function CustomizerCode({ themeName }: { themeName: string }) {
  const activeTheme = React.useMemo(
    () => baseColors.find((theme) => theme.name === themeName),
    [themeName]
  );
  const activeThemeOKLCH = React.useMemo(
    () => baseColorsOKLCH[themeName as keyof typeof baseColorsOKLCH],
    [themeName]
  );

  const { isCopied: oklchCopied, copyToClipboard: copyOKLCH } =
    useCopyToClipboard();
  const { isCopied: hslCopied, copyToClipboard: copyHSL } =
    useCopyToClipboard();
  const { isCopied: v3Copied, copyToClipboard: copyV3 } = useCopyToClipboard();

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <OklchTabContent
        activeThemeOKLCH={activeThemeOKLCH}
        copyToClipboard={copyOKLCH}
        hasCopied={oklchCopied}
      />
      <HslTabContent
        activeTheme={activeTheme}
        copyToClipboard={copyHSL}
        hasCopied={hslCopied}
      />
      <V3TabContent
        activeTheme={activeTheme}
        copyToClipboard={copyV3}
        hasCopied={v3Copied}
      />
    </div>
  );
}

function getThemeCodeOKLCH(theme: BaseColorOKLCH | undefined, radius: number) {
  if (!theme) {
    return "";
  }

  const rootSection =
    ":root {\n  --radius: " +
    radius +
    "rem;\n" +
    Object.entries(theme.light)
      .map((entry) => `  --${entry[0]}: ${entry[1]};`)
      .join("\n") +
    "\n}\n\n.dark {\n" +
    Object.entries(theme.dark)
      .map((entry) => `  --${entry[0]}: ${entry[1]};`)
      .join("\n") +
    "\n}\n";

  return rootSection;
}

function getThemeCode(theme: BaseColor | undefined, radius: number) {
  if (!theme) {
    return "";
  }

  return template(BASE_STYLES_WITH_VARIABLES)({
    colors: theme.cssVars,
    radius: radius.toString(),
  });
}

function getThemeCodeHSLV4(theme: BaseColor | undefined, radius: number) {
  if (!theme) {
    return "";
  }

  const rootSection =
    ":root {\n  --radius: " +
    radius +
    "rem;\n" +
    Object.entries(theme.cssVars.light)
      .map((entry) => `  --${entry[0]}: hsl(${entry[1]});`)
      .join("\n") +
    "\n}\n\n.dark {\n" +
    Object.entries(theme.cssVars.dark)
      .map((entry) => `  --${entry[0]}: hsl(${entry[1]});`)
      .join("\n") +
    "\n}\n";

  return rootSection;
}

const BASE_STYLES_WITH_VARIABLES = `
@layer base {
  :root {
    --background: <%- colors.light["background"] %>;
    --foreground: <%- colors.light["foreground"] %>;
    --card: <%- colors.light["card"] %>;
    --card-foreground: <%- colors.light["card-foreground"] %>;
    --popover: <%- colors.light["popover"] %>;
    --popover-foreground: <%- colors.light["popover-foreground"] %>;
    --primary: <%- colors.light["primary"] %>;
    --primary-foreground: <%- colors.light["primary-foreground"] %>;
    --secondary: <%- colors.light["secondary"] %>;
    --secondary-foreground: <%- colors.light["secondary-foreground"] %>;
    --muted: <%- colors.light["muted"] %>;
    --muted-foreground: <%- colors.light["muted-foreground"] %>;
    --accent: <%- colors.light["accent"] %>;
    --accent-foreground: <%- colors.light["accent-foreground"] %>;
    --destructive: <%- colors.light["destructive"] %>;
    --destructive-foreground: <%- colors.light["destructive-foreground"] %>;
    --border: <%- colors.light["border"] %>;
    --input: <%- colors.light["input"] %>;
    --ring: <%- colors.light["ring"] %>;
    --radius: <%- radius %>rem;
    --chart-1: <%- colors.light["chart-1"] %>;
    --chart-2: <%- colors.light["chart-2"] %>;
    --chart-3: <%- colors.light["chart-3"] %>;
    --chart-4: <%- colors.light["chart-4"] %>;
    --chart-5: <%- colors.light["chart-5"] %>;
  }

  .dark {
    --background: <%- colors.dark["background"] %>;
    --foreground: <%- colors.dark["foreground"] %>;
    --card: <%- colors.dark["card"] %>;
    --card-foreground: <%- colors.dark["card-foreground"] %>;
    --popover: <%- colors.dark["popover"] %>;
    --popover-foreground: <%- colors.dark["popover-foreground"] %>;
    --primary: <%- colors.dark["primary"] %>;
    --primary-foreground: <%- colors.dark["primary-foreground"] %>;
    --secondary: <%- colors.dark["secondary"] %>;
    --secondary-foreground: <%- colors.dark["secondary-foreground"] %>;
    --muted: <%- colors.dark["muted"] %>;
    --muted-foreground: <%- colors.dark["muted-foreground"] %>;
    --accent: <%- colors.dark["accent"] %>;
    --accent-foreground: <%- colors.dark["accent-foreground"] %>;
    --destructive: <%- colors.dark["destructive"] %>;
    --destructive-foreground: <%- colors.dark["destructive-foreground"] %>;
    --border: <%- colors.dark["border"] %>;
    --input: <%- colors.dark["input"] %>;
    --ring: <%- colors.dark["ring"] %>;
    --chart-1: <%- colors.dark["chart-1"] %>;
    --chart-2: <%- colors.dark["chart-2"] %>;
    --chart-3: <%- colors.dark["chart-3"] %>;
    --chart-4: <%- colors.dark["chart-4"] %>;
    --chart-5: <%- colors.dark["chart-5"] %>;
  }
}
`;
