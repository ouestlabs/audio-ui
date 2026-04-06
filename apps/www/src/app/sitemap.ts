import type { MetadataRoute } from "next";
import { appConfig } from "@/lib/config";
import { source } from "@/lib/source";

export const revalidate = false;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const url = (path: string): string => new URL(path, appConfig.url).toString();
  const items = await Promise.all(
    source.getPages().map((page) => {
      const { lastModified: date } = page.data;
      let lastModified: Date | undefined;
      if (date) {
        const newDate = new Date(date);
        if (!Number.isNaN(newDate.getTime())) {
          lastModified = newDate;
        }
      }
      return {
        url: url(page.url),
        lastModified,
        changeFrequency: "weekly",
        priority: 0.5,
      } as MetadataRoute.Sitemap[number];
    })
  );

  return [
    {
      url: url("/"),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: url("/blocks"),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: url("/docs"),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    ...items.filter((v) => v !== undefined),
  ];
}
