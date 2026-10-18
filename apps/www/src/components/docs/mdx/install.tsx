import * as React from "react";
import { CodeBlockCommand } from "@/components/code/block/code-block-command";
import { CodeTabs } from "@/components/code/block/code-tabs";
import { DocsComponentSource } from "@/components/code/source/docs-component-source";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { packageManagerCommands } from "@/lib/code/highlight-code";
import {
  type InstallPart,
  type InstallProps,
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
        className="scrollbar-y min-w-0 overflow-x-auto px-4 py-3.5 outline-none has-data-[slot=tabs]:p-0 th-code th-code--shell"
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
function keyOf(part: InstallPart) {
  if (part.type === "command") {
    return part.code;
  }
  return part.type === "text" ? part.text : part.name;
}

function Part({ part }: { part: InstallPart }) {
  if (part.type === "command") {
    return <Command code={part.code} />;
  }
  if (part.type === "text") {
    // The text is Markdown with inline code: the odd pieces between backticks.
    return (
      <p>
        {part.text
          .split("`")
          .map((piece, index) =>
            index % 2 === 1 ? (
              <code key={piece}>{piece}</code>
            ) : (
              <React.Fragment key={piece}>{piece}</React.Fragment>
            )
          )}
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
        <TabsTrigger value="cli">CLI</TabsTrigger>
        <TabsTrigger value="manual">Manual</TabsTrigger>
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
    </CodeTabs>
  );
}
