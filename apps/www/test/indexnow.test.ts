import { describe, expect, test } from "bun:test";
import { INDEXNOW_KEY, sitemapUrls, submission } from "../scripts/indexnow.ts";

/** What the protocol takes as a key: 8 to 128 letters, digits or dashes. */
const KEY_SHAPE = /^[a-zA-Z0-9-]{8,128}$/;

describe("IndexNow", () => {
  test("the key is one the protocol takes, and the site serves it in its file", async () => {
    expect(INDEXNOW_KEY).toMatch(KEY_SHAPE);
    const file = Bun.file(`${import.meta.dir}/../public/${INDEXNOW_KEY}.txt`);
    expect(await file.text()).toBe(INDEXNOW_KEY);
  });

  test("submits the sitemap's addresses on the site's own host", () => {
    const urls = sitemapUrls(
      "<urlset><url><loc>https://www.audio-ui.dev/</loc></url><url><loc>https://www.audio-ui.dev/docs</loc></url><url><loc>https://elsewhere.dev/x</loc></url></urlset>"
    );
    expect(submission(urls)).toEqual({
      host: "www.audio-ui.dev",
      key: INDEXNOW_KEY,
      keyLocation: `https://www.audio-ui.dev/${INDEXNOW_KEY}.txt`,
      urlList: ["https://www.audio-ui.dev/", "https://www.audio-ui.dev/docs"],
    });
  });
});
