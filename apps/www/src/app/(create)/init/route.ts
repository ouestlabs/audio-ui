import { type NextRequest, NextResponse } from "next/server";
import { registryItemSchema } from "shadcn/schema";

import { buildRegistryBase, designSystemConfigSchema } from "@/registry/config";

export function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const result = designSystemConfigSchema.safeParse({
      base: searchParams.get("base"),
      baseColor: searchParams.get("baseColor"),
      font: searchParams.get("font"),
      iconLibrary: searchParams.get("iconLibrary"),
      menuAccent: searchParams.get("menuAccent"),
      menuColor: searchParams.get("menuColor"),
      radius: searchParams.get("radius"),
      style: searchParams.get("style"),
      template: searchParams.get("template"),
      theme: searchParams.get("theme"),
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const registryBase = buildRegistryBase(result.data);
    const parseResult = registryItemSchema.safeParse(registryBase);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          details: parseResult.error.format(),
          error: "Invalid registry base item",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(parseResult.data, {
      headers: {
        "Cache-Control":
          "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "An unknown error occurred",
      },
      { status: 500 }
    );
  }
}
