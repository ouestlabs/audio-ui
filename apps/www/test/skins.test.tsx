import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import type { ReactElement } from "react";

mock.module("@/lib/utils", () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(" "),
}));

const { Knob } = await import("@/registry/bases/shared/audio-ui/elements/knob");
const { Fader } = await import(
  "@/registry/bases/shared/audio-ui/elements/fader"
);
const { DevicePanel } = await import(
  "@/registry/bases/shared/audio-ui/panels/device-panel"
);
const { compressorDevice } = await import(
  "@/registry/bases/shared/devices/compressor/device"
);
const { HARDWARE_CSS } = await import(
  "@/registry/bases/shared/audio-ui/skins/hardware-css"
);
const { NEU_CSS } = await import(
  "@/registry/bases/shared/audio-ui/skins/neu-css"
);
const { AXES } = await import("@/registry/bases/shared/audio-ui/skins/axes");
const { plainSkinSheet, skinSheet } = await import("../scripts/skin-css.ts");

afterEach(cleanup);

const ignore = () => undefined;

const ID = /[a-z0-9_-]*(?:«|_r_|:r)[^\s"]*/gi;

/** What assistive technology and the keyboard see: every element with a role, ARIA or a tab stop, and its attributes. */
function accessibility(element: ReactElement) {
  const { container } = render(element);
  const tree = [...container.querySelectorAll("*")]
    .filter(
      (node) =>
        node.matches("input, output, [role], [tabindex]") ||
        [...node.attributes].some(({ name }) => name.startsWith("aria-"))
    )
    .filter((node) => !node.closest("[aria-hidden=true]"))
    .map((node) =>
      [
        node.tagName,
        ...[...node.attributes]
          .filter(
            ({ name }) =>
              name.startsWith("aria-") ||
              ["role", "tabindex", "type", "min", "max", "step"].includes(name)
          )
          .map(({ name, value }) => `${name}=${value.replace(ID, "id")}`)
          .sort(),
      ].join(" ")
    );
  cleanup();
  return tree;
}

/** A part of each element a skin dresses: its rules name them, so the skin reads the same in every framework. */
const DRESSED = [
  "knob-control",
  "fader-thumb",
  "xypad-control",
  "envelope-frame",
  "pad-item",
  "piano",
];

const SKINS = [
  { css: HARDWARE_CSS, name: "hardware" },
  { css: NEU_CSS, name: "neu" },
] as const;

describe.each([...SKINS])("the $name skin", ({ css, name }) => {
  const source = `${name}-css.ts`;

  test("the site's sheet is the registry's css", async () => {
    const sheet = await Bun.file(
      `${import.meta.dir}/../src/registry/styles/skins/${name}.css`
    ).text();
    expect(sheet).toBe(skinSheet(css, source));
  });

  test("it is served as plain CSS, its materials as classes, the one sheet every framework reads", async () => {
    const sheet = await Bun.file(
      `${import.meta.dir}/../public/css/skins/${name}.css`
    ).text();
    expect(sheet).toBe(plainSkinSheet(css, source));
    expect(sheet).not.toContain("@utility");
    expect(sheet).toContain(".audio-body {");
  });

  test("it is drawn on the elements' own parts: no face of its own, in any framework", () => {
    const selectors = Object.keys(css).join("\n");
    for (const part of DRESSED) {
      expect(selectors).toContain(`[data-slot=${part}]`);
    }
  });

  test("a knob and a fader in it say what they said", () => {
    for (const element of [
      <Knob aria-label="Level" defaultValue={30} key="knob" />,
      <Fader aria-label="Volume" defaultValue={-6} key="fader" />,
    ]) {
      expect(
        accessibility(<div className={`skin-${name}`}>{element}</div>)
      ).toEqual(accessibility(element));
    }
  });

  test("a device panel wears it, and says what it said", () => {
    const panel = (
      <DevicePanel
        device={compressorDevice}
        onValueChange={ignore}
        value={compressorDevice.defaults()}
      />
    );
    expect(
      accessibility(<div className={`skin-${name}`}>{panel}</div>)
    ).toEqual(accessibility(panel));
  });
});

describe("the axes", () => {
  test.each([
    ["Hardware", HARDWARE_CSS[".skin-hardware"]],
    ["Neu", NEU_CSS[".skin-neu"]],
  ])(
    "%s starts from every axis, and from a shade and an accent of its own",
    (_name, rules) => {
      for (const axis of Object.keys(AXES)) {
        expect(rules).toHaveProperty(axis);
      }
      expect(rules).toHaveProperty("--audio-shade");
      expect(rules).toHaveProperty("--audio-accent");
    }
  );

  test.each([
    ["Hardware", HARDWARE_CSS[".dark .skin-hardware"]],
    ["Neu", NEU_CSS[".dark .skin-neu"]],
  ])("%s in the dark is the same skin on another shade", (_name, rules) => {
    expect(Object.keys(rules).sort()).toEqual([
      "--audio-accent",
      "--audio-shade",
    ]);
  });
});
