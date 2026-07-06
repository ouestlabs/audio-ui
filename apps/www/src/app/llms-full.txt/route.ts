import { processMdxForLLMs } from "@/lib/llm";
import { source } from "@/lib/source";

export const revalidate = false;

export async function GET() {
  const pages = source.getPages();
  const scanned = await Promise.all(
    pages.map(async (page) => {
      const raw = await page.data.getText("raw");
      return `# ${page.data.title}\n\n${processMdxForLLMs(raw)}`;
    })
  );

  return new Response(scanned.join("\n\n"));
}
