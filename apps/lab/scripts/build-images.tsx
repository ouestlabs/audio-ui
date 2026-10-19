/**
 * Writes the lab's Open Graph images to public/og/, at build: one card for the
 * home and one per device, from its `meta.json` and, when the folder has one,
 * its `preview.png`, shown in a frame. They are files, not routes: the site
 * serves them as static assets, and Workers render nothing per request.
 *
 * bun run images:build
 */
import { Resvg } from "@resvg/resvg-js";
import type { ReactElement } from "react";
import satori from "satori";
import { SITE } from "../src/lib/seo.ts";

const root = `${import.meta.dir}/..`;
const DEVICES = `${root}/src/components/devices`;
const FONTS = `${root}/node_modules/@fontsource`;
const SIZE = { height: 630, width: 1200 };

/** The docs' dark palette, as their own cards draw it. */
const tokens = {
  background: "#0a0a0a",
  border: "#333333",
  chip: "#1a1a1a",
  foreground: "#e8e8e8",
  frame: "#111111",
  muted: "#8a8a8a",
};

const KNOB_PATH =
  "M13.799 11.884L18.243 4.188A10 10 0 1 1 15.645 2.688L11.201 10.384Z";

interface Device {
  category: string;
  description: string;
  preview: string | null;
  slug: string;
  title: string;
  uses: string[];
}

const font = (path: string) => Bun.file(`${FONTS}/${path}`).arrayBuffer();
const fonts = [
  Object.freeze({
    data: await font(
      "instrument-serif/files/instrument-serif-latin-400-normal.woff"
    ),
    name: "Instrument Serif",
    style: "normal",
    weight: 400,
  }),
  Object.freeze({
    data: await font(
      "bricolage-grotesque/files/bricolage-grotesque-latin-400-normal.woff"
    ),
    name: "Bricolage Grotesque",
    style: "normal",
    weight: 400,
  }),
  Object.freeze({
    data: await font(
      "bricolage-grotesque/files/bricolage-grotesque-latin-600-normal.woff"
    ),
    name: "Bricolage Grotesque",
    style: "normal",
    weight: 600,
  }),
];

function Mark() {
  return (
    <div style={{ alignItems: "center", display: "flex", gap: "12px" }}>
      <svg
        aria-hidden="true"
        fill={tokens.foreground}
        height="32"
        viewBox="2 2 20 20"
        width="32"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d={KNOB_PATH} />
      </svg>
      <div
        style={{
          color: tokens.foreground,
          display: "flex",
          fontFamily: "Instrument Serif",
          fontSize: "34px",
        }}
      >
        audio/ui
      </div>
      <div
        style={{
          border: `1px solid ${tokens.border}`,
          borderRadius: "8px",
          color: tokens.muted,
          display: "flex",
          fontFamily: "Bricolage Grotesque",
          fontSize: "20px",
          padding: "2px 10px",
        }}
      >
        lab
      </div>
    </div>
  );
}

function Chip({ children }: { children: string }) {
  return (
    <div
      style={{
        background: tokens.chip,
        border: `1px solid ${tokens.border}`,
        borderRadius: "8px",
        color: tokens.muted,
        display: "flex",
        fontFamily: "Bricolage Grotesque",
        fontSize: "20px",
        padding: "4px 12px",
      }}
    >
      {children}
    </div>
  );
}

/** What the device looks like, in a frame: the docs' rounded border around a capture. */
function Frame({ preview }: { preview: string }) {
  return (
    <div
      style={{
        background: tokens.frame,
        border: `1px solid ${tokens.border}`,
        borderRadius: "24px",
        display: "flex",
        padding: "8px",
      }}
    >
      <img
        alt=""
        height={320}
        src={preview}
        style={{ borderRadius: "16px", objectFit: "cover" }}
        width={608}
      />
    </div>
  );
}

function Card({
  chips,
  description,
  preview,
  title,
}: {
  chips: string[];
  description: string;
  preview: string | null;
  title: string;
}) {
  return (
    <div
      style={{
        background: tokens.background,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        justifyContent: "space-between",
        padding: "56px",
        width: "100%",
      }}
    >
      <Mark />
      <div style={{ alignItems: "center", display: "flex", gap: "40px" }}>
        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            gap: "20px",
          }}
        >
          <div
            style={{
              color: tokens.foreground,
              display: "flex",
              fontFamily: "Instrument Serif",
              fontSize: "88px",
              lineHeight: 1,
            }}
          >
            {title}
          </div>
          <div
            style={{
              color: tokens.muted,
              display: "flex",
              fontFamily: "Bricolage Grotesque",
              fontSize: "28px",
              lineHeight: 1.3,
            }}
          >
            {description}
          </div>
        </div>
        {preview ? <Frame preview={preview} /> : null}
      </div>
      <div style={{ display: "flex", gap: "10px", minHeight: "36px" }}>
        {chips.map((chip) => (
          <Chip key={chip}>{chip}</Chip>
        ))}
      </div>
    </div>
  );
}

async function png(element: ReactElement) {
  const svg = await satori(element, { ...SIZE, fonts });
  return new Resvg(svg, { fitTo: { mode: "width", value: SIZE.width } })
    .render()
    .asPng();
}

async function readDevices(): Promise<Device[]> {
  const files = await Array.fromAsync(
    new Bun.Glob("*/meta.json").scan({ cwd: DEVICES })
  );
  return Promise.all(
    files.sort().map(async (file) => {
      const slug = file.split("/")[0] ?? "";
      const meta = await Bun.file(`${DEVICES}/${file}`).json();
      const preview = Bun.file(`${DEVICES}/${slug}/preview.png`);
      return {
        category: meta.category ?? "Other",
        description: meta.description,
        preview: (await preview.exists())
          ? `data:image/png;base64,${Buffer.from(await preview.arrayBuffer()).toString("base64")}`
          : null,
        slug,
        title: meta.title,
        uses: meta.uses ?? [],
      };
    })
  );
}

const devices = await readDevices();
await Promise.all([
  Bun.write(
    `${root}/public/og/default.png`,
    await png(
      <Card
        chips={devices.map((device) => device.title)}
        description={SITE.description}
        preview={devices[0]?.preview ?? null}
        title="Audio interfaces you can play"
      />
    )
  ),
  ...devices.map(async (device) =>
    Bun.write(
      `${root}/public/og/${device.slug}.png`,
      await png(
        <Card
          chips={[device.category, ...device.uses]}
          description={device.description}
          preview={device.preview}
          title={device.title}
        />
      )
    )
  ),
]);
console.log(
  `Wrote the home image and ${devices.length} device images to public/og/`
);
