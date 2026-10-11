import { remarkMdxMermaid } from "fumadocs-core/mdx-plugins";
import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import lastModified from "fumadocs-mdx/plugins/last-modified";

import { rehypeCode } from "./src/lib/rehype-code";

export const docs = defineDocs({
  dir: "src/content/docs",
});

export default defineConfig({
  mdxOptions: {
    rehypePlugins: (plugins) => {
      plugins.shift();
      plugins.push(rehypeCode);

      return plugins;
    },
    remarkPlugins: [remarkMdxMermaid],
  },
  plugins: [lastModified()],
});
