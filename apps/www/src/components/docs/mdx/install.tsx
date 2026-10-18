import { Link } from "@tanstack/react-router";
import * as React from "react";
import { CodeBlockCommand } from "@/components/code/block/code-block-command";
import { CodeTabs } from "@/components/code/block/code-tabs";
import { CopyButton } from "@/components/code/copy/copy-button";
import { DocsComponentSource } from "@/components/code/source/docs-component-source";
import { Icons } from "@/components/site/icons";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { packageManagerCommands } from "@/lib/code/highlight-code";
import {
  type InstallPart,
  type InstallProps,
  installAgent,
  installPlan,
} from "@/lib/docs/content/install-docs";

/** What the page's own `Step` and `Steps` draw, passed in so the section looks like the rest of the page. */
interface InstallParts {
  Step: React.ComponentType<React.ComponentProps<"h3">>;
  Steps: React.ComponentType<React.ComponentProps<"div">>;
  TabsContent: React.ComponentType<
    React.ComponentProps<"div"> & { value: string }
  >;
}

/** A command as the page's fences draw it: with the other package managers beside the one the reader uses. */
function Command({ code }: { code: string }) {
  const commands = packageManagerCommands(code);
  return (
    <figure className="" data-not-typeset="" data-rehype-pretty-code-figure="">
      <pre
        className="scrollbar-y min-w-0 overflow-x-auto py-3.5 pr-14 pl-4 outline-none has-data-[slot=tabs]:p-0 th-code th-code--shell"
        data-language="shell"
      >
        {commands ? (
          <CodeBlockCommand
            __bun__={commands.bun}
            __npm__={commands.npm}
            __pnpm__={commands.pnpm}
            __yarn__={commands.yarn}
          />
        ) : (
          <code>{code}</code>
        )}
      </pre>
    </figure>
  );
}

/** What a part is, as a key: its own text, so two parts of a list never share one. */
// What the text of a part writes in Markdown: inline code and links.
const INLINE = /(`[^`]+`|\[[^\]]+\]\([^)]+\))/;
const LINK = /^\[([^\]]+)\]\(([^)]+)\)$/;

function Inline({ piece }: { piece: string }) {
  if (piece.startsWith("`")) {
    return <code>{piece.slice(1, -1)}</code>;
  }
  const link = LINK.exec(piece);
  if (link) {
    return <Link to={link[2]}>{link[1]}</Link>;
  }
  return piece;
}

function keyOf(part: InstallPart) {
  if (part.type === "command") {
    return part.code;
  }
  if (part.type === "prompt") {
    return part.text;
  }
  return part.type === "text" ? part.text : part.name;
}

/** A prompt to copy, drawn as a fence of the page is, with no package manager to choose. */
function Prompt({ text }: { text: string }) {
  return (
    <figure className="" data-not-typeset="" data-rehype-pretty-code-figure="">
      <pre
        className="scrollbar-y min-w-0 overflow-x-auto py-3.5 pr-14 pl-4 outline-none has-data-[slot=tabs]:p-0 th-code th-code--text"
        data-language="text"
      >
        <CopyButton value={text} />
        <code className="whitespace-pre-wrap">{text}</code>
      </pre>
    </figure>
  );
}

function Part({ part }: { part: InstallPart }) {
  if (part.type === "command") {
    return <Command code={part.code} />;
  }
  if (part.type === "prompt") {
    return <Prompt text={part.text} />;
  }
  if (part.type === "text") {
    return (
      <p>
        {part.text.split(INLINE).map((piece) => (
          <Inline key={piece} piece={piece} />
        ))}
      </p>
    );
  }
  return (
    <DocsComponentSource
      className="not-typeset"
      name={part.name}
      styleName="base-nova"
      title={part.title}
    />
  );
}

/**
 * The Installation section of a component's page: the CLI tab and the Manual
 * tab, drawn from `installPlan`, which is also what the markdown pages print.
 */
export function Install({
  Step,
  Steps,
  TabsContent,
  ...props
}: InstallProps & InstallParts) {
  const plan = installPlan(props);
  return (
    <CodeTabs>
      <TabsList>
        <TabsTrigger value="cli">
          <Icons.shadcn className="size-3.5" /> CLI
        </TabsTrigger>
        <TabsTrigger value="manual">
          <Icons.react className="size-3.5" /> Manual
        </TabsTrigger>
        <TabsTrigger value="agent">
          <Icons.sparkle className="size-3.5" /> Agent
        </TabsTrigger>
      </TabsList>
      <TabsContent value="cli">
        {plan.cli.map((part) => (
          <Part key={keyOf(part)} part={part} />
        ))}
      </TabsContent>
      <TabsContent value="manual">
        <Steps>
          {plan.manual.map(({ parts, step }) => (
            <React.Fragment key={step}>
              <Step>{step}</Step>
              {parts.map((part) => (
                <Part key={keyOf(part)} part={part} />
              ))}
            </React.Fragment>
          ))}
        </Steps>
      </TabsContent>
      <TabsContent value="agent">
        <InstallAgentParts name={props.name} />
      </TabsContent>
    </CodeTabs>
  );
}

/** What the Agent tab holds, for a page that writes its own tabs. */
export function InstallAgentParts({ name }: { name: string }) {
  return installAgent(name).map((part) => (
    <Part key={keyOf(part)} part={part} />
  ));
}
