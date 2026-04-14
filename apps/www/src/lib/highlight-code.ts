import { transformerNotationWordHighlight } from "@shikijs/transformers";
import { codeToHtml, type ShikiTransformer } from "shiki";

export const transformers = [
  {
    code(node) {
      if (node.tagName === "code") {
        node.properties.__raw__ = this.source;
        if (this.source.includes("\n")) {
          node.properties["data-line-numbers"] = "";
        }
      }
    },
  },
  transformerNotationWordHighlight(),
] satisfies ShikiTransformer[];

export async function highlightCode(
  code: string,
  language = "tsx",
  options?: { showLineNumbers?: boolean }
) {
  const { showLineNumbers = true } = options ?? {};

  const html = await codeToHtml(code, {
    lang: language,
    themes: {
      dark: "github-dark",
      light: "github-light",
    },
    transformers: [
      {
        code(node) {
          if (showLineNumbers) {
            node.properties["data-line-numbers"] = "";
          }
        },
        line(node) {
          node.properties["data-line"] = "";
        },
      },
      transformerNotationWordHighlight(),
    ],
  });

  return html;
}
