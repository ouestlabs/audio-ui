import { notFound } from "next/navigation";
import { loadOGFont } from "@/lib/fonts";
import { generateDocsOG, makeImageResponse } from "@/lib/og";
import { source } from "@/lib/source";

export const revalidate = false;
export const size = { width: 1200, height: 630 };

export async function GET(
  _req: Request,
  { params }: RouteContext<"/og/docs/[[...slug]]">
) {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) {
    notFound();
  }

  const fontData = await loadOGFont();

  return makeImageResponse(
    generateDocsOG({
      title: page.data.title,
      description: page.data.description,
    }),
    fontData
  );
}

export function generateStaticParams() {
  return source.generateParams().map((params) => ({
    slug: params.slug ?? undefined,
  }));
}
