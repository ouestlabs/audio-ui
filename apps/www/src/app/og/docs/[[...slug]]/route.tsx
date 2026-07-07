import { notFound } from "next/navigation";
import { loadOGFont } from "@/lib/fonts";
import { generateDocsOG, makeImageResponse } from "@/lib/og";
import { source } from "@/lib/source";

export const revalidate = false;
export const size = { height: 630, width: 1200 };

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
      description: page.data.description,
      title: page.data.title,
    }),
    fontData
  );
}

export function generateStaticParams() {
  return source.generateParams().map((params) => ({
    slug: params.slug ?? undefined,
  }));
}
