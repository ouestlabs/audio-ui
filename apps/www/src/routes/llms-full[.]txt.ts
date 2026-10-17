import { createFileRoute } from "@tanstack/react-router";
import { processMdxForLLMs, readRawDoc } from "@/lib/docs/content/docs-text";
import { source } from "@/lib/docs/content/source";

export const Route = createFileRoute("/llms-full.txt")({
  server: {
    handlers: {
      GET: async () => {
        const scanned = await Promise.all(
          source.getPages().map(async (page) => {
            const raw = await readRawDoc(page.path);
            return `# ${page.data.title}\n\n${await processMdxForLLMs(raw)}`;
          })
        );
        return new Response(scanned.join("\n\n"), {
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      },
    },
  },
});
