import { processMdxForLLMs, readRawDoc } from "@/lib/docs-text";
import { source } from "@/lib/source";

/** A docs page as markdown, at its address under /llm. */
export async function markdownOfPage(slugs: string[]) {
  const page = source.getPage(slugs);
  if (!page) {
    return new Response("Not found", { status: 404 });
  }
  const raw = await readRawDoc(page.path);
  return new Response(await processMdxForLLMs(raw), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
