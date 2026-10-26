/**
 * Tells the search engines of IndexNow (Bing, Yandex, Seznam, Naver and the
 * others that share its submissions) every address of the deployed sitemap,
 * so they read new and changed pages without waiting to crawl. The key is
 * public by design: the engines check it against `/<key>.txt` on the site.
 * Run it after a deploy that changes pages.
 *
 *   bun run indexnow
 *
 * Protocol: https://www.indexnow.org/documentation
 */

const SITE = "https://www.audio-ui.dev";
/** Its file is `public/<key>.txt`, which holds the key alone. */
export const INDEXNOW_KEY = "fdbd125568cf6c9a8083d2198dbc4133";
const ENDPOINT = "https://api.indexnow.org/indexnow";
const LOC = /<loc>([^<]+)<\/loc>/g;

/** The body of one submission: every address on the site's host, at most 10,000. */
export function submission(urls: string[]) {
  const { host } = new URL(SITE);
  return {
    host,
    key: INDEXNOW_KEY,
    keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`,
    urlList: urls.filter((url) => new URL(url).host === host).slice(0, 10_000),
  };
}

/** The addresses a sitemap lists. */
export function sitemapUrls(xml: string) {
  return [...xml.matchAll(LOC)].map((match) => match[1] ?? "");
}

if (import.meta.main) {
  const sitemap = await fetch(`${SITE}/sitemap.xml`);
  const body = submission(sitemapUrls(await sitemap.text()));
  const response = await fetch(ENDPOINT, {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json; charset=utf-8" },
    method: "POST",
  });
  // 200: taken; 202: taken, the key still being checked. Anything else is a refusal.
  console.log(
    `IndexNow: ${response.status} for ${body.urlList.length} addresses`
  );
  if (!(response.status === 200 || response.status === 202)) {
    console.error(await response.text());
    process.exit(1);
  }
}
