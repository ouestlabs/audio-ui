/**
 * The Installation section of a component's page, written once. A page says
 * `<Install name="knob" packages="@audio-ui/react class-variance-authority" />`
 * and the site draws the CLI tab and the Manual tab from it; the pages served
 * as markdown get the same text from `expandInstall`.
 */

export interface InstallProps {
  /** `"device"` for a page of a device: its state, its panel and its engine install together. */
  kind?: "device";
  /** The registry item, `npx shadcn@latest add @audio-ui/<name>`. */
  name: string;
  /** The npm packages the component imports. @default "@audio-ui/react" (a device: react and core) */
  packages?: string;
  /** The registry item whose source the Manual tab shows. @default name (a device: its demo, `block-<name>`) */
  source?: string;
  /** Where the source lands in a project. @default components/audio-ui/<name>.tsx */
  title?: string;
}

export type InstallPart =
  | { code: string; type: "command" }
  | { text: string; type: "prompt" }
  | { name: string; title: string; type: "source" }
  | { text: string; type: "text" };

export interface InstallPlan {
  /** What to tell an agent: the skill that wires the component, and the MCP server that reads the docs. */
  agent: InstallPart[];
  cli: InstallPart[];
  manual: { parts: InstallPart[]; step: string }[];
}

/** The third tab of an installation: working with an agent, which is what the skill and the MCP server are for. */
export function installAgent(name: string): InstallPart[] {
  return [
    {
      text: "Give your agent the skill, and it picks the component, installs it and wires it to your audio:",
      type: "text",
    },
    { code: "npx skills add ouestlabs/audio-ui", type: "command" },
    { text: "Then ask it:", type: "text" },
    {
      text: `Add the ${name.replaceAll("-", " ")} from audio/ui to my project and wire it to my audio code.`,
      type: "prompt",
    },
    {
      text: "To let the agent read the docs live, connect the [MCP server](/docs/mcp). More in [Agent Skill](/docs/agents).",
      type: "text",
    },
  ];
}

const REACT = "@audio-ui/react";
const REACT_AND_CORE = "@audio-ui/react @audio-ui/core";

/** What the two tabs hold, as data: the site draws it, and the markdown pages print it. */
export function installPlan(props: InstallProps): InstallPlan {
  const { name } = props;
  const add = (items: string) => `npx shadcn@latest add ${items}`;
  if (props.kind === "device") {
    const demo = props.source ?? `block-${name}`;
    return {
      agent: installAgent(name),
      cli: [
        { code: add(`@audio-ui/${name}`), type: "command" },
        {
          text: `It installs the device's state, its engine and its panel to \`components/audio-ui/devices/${name}/\`. The demo above, which wires them to a loop, is \`@audio-ui/${demo}\`.`,
          type: "text",
        },
      ],
      manual: [
        {
          parts: [
            {
              code: `npm install ${props.packages ?? REACT_AND_CORE}`,
              type: "command",
            },
          ],
          step: "Install the packages:",
        },
        {
          parts: [
            {
              code: add(
                `@audio-ui/${name}-device @audio-ui/${name}-panel @audio-ui/${name}-engine`
              ),
              type: "command",
            },
          ],
          step: "Add the pieces you want. All of them, or only the state and the panel if your engine is elsewhere:",
        },
        {
          parts: [
            {
              name: demo,
              title: props.title ?? `components/examples/${demo}.tsx`,
              type: "source",
            },
          ],
          step: "Copy and paste the demo that wires them, if you want it.",
        },
      ],
    };
  }
  return {
    agent: installAgent(name),
    cli: [{ code: add(`@audio-ui/${name}`), type: "command" }],
    manual: [
      {
        parts: [
          {
            code: `npm install ${props.packages ?? REACT}`,
            type: "command",
          },
        ],
        step: "Install the following dependencies:",
      },
      {
        parts: [
          {
            name: props.source ?? name,
            title: props.title ?? `components/audio-ui/${name}.tsx`,
            type: "source",
          },
        ],
        step: "Copy and paste the following code into your project.",
      },
      {
        parts: [],
        step: "Update the import paths to match your project setup.",
      },
    ],
  };
}

function partMdx(part: InstallPart, fence = "bash"): string {
  if (part.type === "command") {
    return `\`\`\`${fence}\n${part.code}\n\`\`\``;
  }
  if (part.type === "text") {
    return part.text;
  }
  if (part.type === "prompt") {
    return `\`\`\`text\n${part.text}\n\`\`\``;
  }
  return `<ComponentSource\n  styleName="base-nova"\n  name="${part.name}"\n  title="${part.title}"\n/>`;
}

/** The plan as the MDX the pages used to carry: the form the markdown conversion reads. */
export function installMdx(props: InstallProps): string {
  const plan = installPlan(props);
  return [
    "<CodeTabs>",
    "",
    "<TabsList>",
    '  <TabsTrigger value="cli">CLI</TabsTrigger>',
    '  <TabsTrigger value="manual">Manual</TabsTrigger>',
    '  <TabsTrigger value="agent">Agent</TabsTrigger>',
    "</TabsList>",
    "",
    '<TabsContent value="cli">',
    "",
    ...plan.cli.flatMap((part) => [partMdx(part, "bash component"), ""]),
    "</TabsContent>",
    "",
    '<TabsContent value="manual">',
    "",
    "<Steps>",
    "",
    ...plan.manual.flatMap(({ parts, step }) => [
      `<Step>${step}</Step>`,
      "",
      ...parts.flatMap((part) => [partMdx(part), ""]),
    ]),
    "</Steps>",
    "",
    "</TabsContent>",
    "",
    '<TabsContent value="agent">',
    "",
    ...plan.agent.flatMap((part) => [partMdx(part), ""]),
    "</TabsContent>",
    "",
    "</CodeTabs>",
  ].join("\n");
}

const INSTALL_REGEX = /<Install\s+([^>]*?)\/>/g;
const ATTR_REGEX = /([a-zA-Z]+)="([^"]*)"/g;

/** The props written on an `<Install ... />` tag. */
export function parseInstallProps(attrs: string): InstallProps | null {
  const found: Record<string, string> = {};
  for (const [, key, value] of attrs.matchAll(ATTR_REGEX)) {
    if (key && value !== undefined) {
      found[key] = value;
    }
  }
  if (!found.name) {
    return null;
  }
  return {
    kind: found.kind === "device" ? "device" : undefined,
    name: found.name,
    packages: found.packages,
    source: found.source,
    title: found.title,
  };
}

const AGENT_REGEX = /<InstallAgent\s+name="([a-z-]+)"\s*\/>/g;

/** Each `<InstallAgent />` of a page, in the pages that write their own tabs, as the text of the tab. */
export function expandInstallAgent(content: string): string {
  return content.replace(AGENT_REGEX, (_tag, name: string) =>
    installAgent(name)
      .map((part) => partMdx(part))
      .join("\n\n")
  );
}

/** Each `<Install />` of a page as the MDX it stands for, so the markdown pages read as they always did. */
export function expandInstall(content: string): string {
  return expandInstallAgent(
    content.replace(INSTALL_REGEX, (tag, attrs: string) => {
      const props = parseInstallProps(attrs);
      return props ? installMdx(props) : tag;
    })
  );
}
