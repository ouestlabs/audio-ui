import { Feed } from "feed";
import { siteConfig } from "@/lib/config";
import { source } from "@/lib/source";

export function getRSS() {
  const feed = new Feed({
    copyright: `All rights reserved ${new Date().getFullYear()}, ${siteConfig.name}`,
    description: siteConfig.description,
    favicon: `${siteConfig.url}/icon`,
    feedLinks: {
      rss: `${siteConfig.url}/rss.xml`,
    },
    generator: siteConfig.name,
    id: `${siteConfig.url}/docs`,
    language: "en",
    link: `${siteConfig.url}/docs`,
    title: siteConfig.name,
  });

  for (const page of source.getPages()) {
    const href = `${siteConfig.url}${page.url}`;
    const date = page.data.lastModified
      ? new Date(page.data.lastModified)
      : new Date();

    feed.addItem({
      author: [
        {
          link: siteConfig.links.twitter,
          name: siteConfig.name,
        },
      ],
      date,
      description: page.data.description,
      id: href,
      link: href,
      title: page.data.title,
    });
  }

  return feed.rss2();
}
