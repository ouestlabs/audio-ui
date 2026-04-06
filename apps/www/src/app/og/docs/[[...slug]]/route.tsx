import { notFound } from "next/navigation";
import { ImageResponse } from "next/og";
import { baseUrl } from "@/lib/config";
import { loadGoogleFont } from "@/lib/fonts";
import { source } from "@/lib/source";

export const revalidate = false;
export const size = {
  width: 1200,
  height: 630,
};

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
      `audio/ui ${page.data.title}`
    );
  } catch {
    // Fallback to default OG renderer fonts when remote font fetch fails.
    fontData = null;
  }

  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        backgroundImage: `url(${baseUrl.origin}/bg.png)`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
        }}
      >
        <p
          style={{
            fontSize: "5rem",
            fontWeight: 600,
            textAlign: "center",
            color: "dimgray",
            fontFamily: "Instrument Serif",
            margin: 0,
            lineHeight: "1",
          }}
        >
          audio/ui
        </p>
        <p
          style={{
            fontSize: "7rem",
            fontWeight: "bold",
            color: "white",
            textAlign: "center",
            fontFamily: "Instrument Serif",
            margin: 0,
            lineHeight: "1",
          }}
        >
          {page.data.title}
        </p>
      </div>
    </div>,
    fontData
      ? {
          ...size,
          fonts: [
            {
              name: "Instrument Serif",
              data: fontData,
              style: "normal",
            },
          ],
        }
      : size
  );
}

export function generateStaticParams() {
  return source.generateParams().map((params) => ({
    slug: params.slug ?? undefined,
  }));
}
