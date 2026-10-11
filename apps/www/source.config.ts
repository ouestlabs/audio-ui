import { remarkMdxMermaid } from "fumadocs-core/mdx-plugins";
import { pageSchema } from "fumadocs-core/source/schema";
import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import lastModified from "fumadocs-mdx/plugins/last-modified";
import { z } from "zod";

import { rehypeCode } from "./src/lib/rehype-code";

export const docs = defineDocs({
  dir: "src/content/docs",
  docs: {
    schema: pageSchema.extend({
      base: z.literal("base").optional(),
      component: z.boolean().optional(),
      links: z
        .object({
          api: z.string().optional(),
          doc: z.string().optional(),
        })
        .optional(),
    }),
  },
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
