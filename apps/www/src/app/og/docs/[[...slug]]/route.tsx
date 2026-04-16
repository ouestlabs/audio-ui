import { notFound } from "next/navigation";
import { loadGoogleFont } from "@/lib/fonts";
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

  let fontData: ArrayBuffer | null = null;
  try {
    fontData = await loadGoogleFont(
      "Instrument Serif",
      `audio/ui docs ${page.data.title} ${page.data.description ?? ""}`
    );
  } catch {
    fontData = null;
  }

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
