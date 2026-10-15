import { rehypePreCodeToHast } from "@tanstack/highlight/rehype";
import { packageManagerCommands } from "./highlight-code";
import { highlighter } from "./highlighter";

type HastNode = {
  children?: HastNode[];
  data?: { meta?: string };
  properties?: Record<string, unknown>;
  tagName?: string;
  type: string;
  value?: string;
};

const TITLE = /title="([^"]*)"/;

function textOf(node: HastNode): string {
  if (node.type === "text") {
    return node.value ?? "";
  }
  return (node.children ?? []).map(textOf).join("");
}

function isCodeBlock(node: HastNode) {
  return (
    node.type === "element" &&
    node.tagName === "pre" &&
    node.children?.length === 1 &&
    node.children[0]?.tagName === "code"
  );
}

const TRAILING_NEWLINE = /\n$/;

/** A fence becomes a figure: its title above it, its code highlighted, and an install command carries its other package managers' forms. */
function toFigure(pre: HastNode): HastNode | null {
  const code = pre.children?.[0] as HastNode;
  const raw = textOf(code).replace(TRAILING_NEWLINE, "");
  const title = TITLE.exec(code.data?.meta ?? "")?.[1];

  const block = rehypePreCodeToHast(pre as never, {
    getTitle: () => title,
    highlighter,
  }) as HastNode | undefined;
  if (!block) {
    return null;
  }

  const commands = packageManagerCommands(raw);
  const inner = block.children?.[0];
  if (inner) {
    // The copy button reads the source from `__raw__`.
    inner.properties = {
      ...inner.properties,
      __raw__: raw,
      ...(commands
        ? {
            __bun__: commands.bun,
            __npm__: commands.npm,
            __pnpm__: commands.pnpm,
            __yarn__: commands.yarn,
          }
        : {}),
    };
  }

  const language = String(block.properties?.dataLanguage ?? "");
  return {
    children: [
      ...(title
        ? [
            {
              children: [{ type: "text", value: title }],
              properties: {
                dataLanguage: language,
                dataRehypePrettyCodeTitle: "",
              },
              tagName: "figcaption",
              type: "element",
            },
          ]
        : []),
      block,
    ],
    properties: { dataRehypePrettyCodeFigure: "" },
    tagName: "figure",
    type: "element",
  };
}

function walk(node: HastNode) {
  if (!node.children) {
    return;
  }
  node.children = node.children.map((child) => {
    if (isCodeBlock(child)) {
      return toFigure(child) ?? child;
    }
    walk(child);
    return child;
  });
}

/** The docs' code fences, highlighted with TanStack Highlight and framed as the site's figures. */
export function rehypeCode() {
  return (tree: HastNode) => walk(tree);
}
