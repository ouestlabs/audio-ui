import { Feed } from "feed";
import { siteConfig } from "@/lib/config";
import { source } from "@/lib/source";

export function getRSS() {
  const feed = new Feed({
    title: siteConfig.name,
    description: siteConfig.description,
    id: `${siteConfig.url}/docs`,
    link: `${siteConfig.url}/docs`,
    language: "en",
    favicon: `${siteConfig.url}/icon`,
    copyright: `All rights reserved ${new Date().getFullYear()}, ${siteConfig.name}`,
    generator: siteConfig.name,
    feedLinks: {
      rss: `${siteConfig.url}/rss.xml`,
    },
  });

  for (const page of source.getPages()) {
    const href = `${siteConfig.url}${page.url}`;
    const date = page.data.lastModified
      ? new Date(page.data.lastModified)
      : new Date();

    feed.addItem({
      id: href,
      title: page.data.title,
      description: page.data.description,
      link: href,
      date,
      author: [
        {
          name: siteConfig.name,
          link: siteConfig.links.twitter,
        },
      ],
    });
  }

  return feed.rss2();
}
