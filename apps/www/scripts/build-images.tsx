/**
 * Writes the site's images to public/: the icons and the Open Graph image of
 * the home (committed), and one Open Graph image per docs page (generated at
 * build, under public/og/docs). They are files, not routes: the site serves
 * them as static assets, and Workers render nothing per request.
 *
 * bun run images:build
 */
import { Resvg } from "@resvg/resvg-js";
import type { ReactElement } from "react";
import satori from "satori";
import { generateDocsOG, generateHomeOG, OG_SIZE } from "../src/lib/og";
import { slugsOf } from "./site-paths";

const root = `${import.meta.dir}/..`;
const DOCS = `${root}/src/content/docs`;

const fontData = await Bun.file(
  `${root}/src/lib/fonts/InstrumentSerif-Regular.ttf`
).arrayBuffer();

async function png(
  element: ReactElement,
  size: { height: number; width: number },
  withFont = false
) {
  const svg = await satori(element, {
    ...size,
    fonts: withFont
      ? [
          {
            data: fontData,
            name: "Instrument Serif",
            style: "normal",
            weight: 700,
          },
        ]
      : [],
  });
  return new Resvg(svg, { fitTo: { mode: "width", value: size.width } })
    .render()
    .asPng();
}

const KNOB_PATH =
  "M13.799 11.884L18.243 4.188A10 10 0 1 1 15.645 2.688L11.201 10.384Z";

/** The knob mark on black, as the favicon, the web app icon and the iOS icon draw it. */
function icon(glyph: number, rounded = false) {
  return (
    <div
      style={{
        alignItems: "center",
        background: "black",
        borderRadius: rounded ? "5px" : "0px",
        display: "flex",
        height: "100%",
        justifyContent: "center",
        width: "100%",
      }}
    >
      <svg
        aria-hidden="true"
        fill="white"
        height={glyph}
        viewBox="2 2 20 20"
        width={glyph}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d={KNOB_PATH} />
      </svg>
    </div>
  );
}

async function write(path: string, bytes: Uint8Array) {
  await Bun.write(`${root}/public/${path}`, bytes);
}

await write("icon.png", await png(icon(20, true), { height: 32, width: 32 }));
// Maskable: full-bleed background, the knob inside the 80% safe zone.
await write("icon-512.png", await png(icon(280), { height: 512, width: 512 }));
await write(
  "apple-icon.png",
  await png(icon(110), { height: 180, width: 180 })
);
await write("og/home.png", await png(generateHomeOG(), OG_SIZE, true));

const FRONTMATTER = /^---\n([\s\S]*?)\n---/;
let count = 0;
for await (const file of new Bun.Glob("**/*.mdx").scan({ cwd: DOCS })) {
  const text = await Bun.file(`${DOCS}/${file}`).text();
  const frontmatter = Bun.YAML.parse(text.match(FRONTMATTER)?.[1] ?? "") as {
    description?: string;
    title?: string;
  };
  const slugs = slugsOf(file);
  await write(
    `og/docs/${slugs.length > 0 ? slugs.join("/") : "index"}.png`,
    await png(
      generateDocsOG({
        description: frontmatter.description,
        title: frontmatter.title ?? "",
      }),
      OG_SIZE,
      true
    )
  );
  count += 1;
}
console.log(
  `Wrote the icons, the home image and ${count} docs images to public/`
);
