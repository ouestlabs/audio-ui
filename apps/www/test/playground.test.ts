import { describe, expect, test } from "bun:test";
import { compile } from "svelte/compiler";
import { compileScript, compileTemplate, parse } from "vue/compiler-sfc";
import {
  codeOf,
  type Framework,
  PLAYGROUNDS,
  type PlaygroundLook,
  type PlaygroundName,
  propsOf,
  type Values,
  webMarkup,
} from "@/lib/docs/playground/playgrounds";

const transpiler = new Bun.Transpiler({ loader: "tsx" });

/** Every combination of a playground's settings. */
function combinations(name: PlaygroundName): Values[] {
  return PLAYGROUNDS[name].controls.reduce<Values[]>(
    (all, control) =>
      all.flatMap((values) =>
        control.options.map((option) => ({ ...values, [control.name]: option }))
      ),
    [{}]
  );
}

const compiles: Record<Framework, (code: string) => void> = {
  react: (code) => {
    transpiler.transformSync(code);
  },
  svelte: (code) => {
    compile(code, { filename: "Example.svelte" });
  },
  vue: (code) => {
    const { descriptor, errors } = parse(code, { filename: "Example.vue" });
    if (errors.length > 0) {
      throw new Error(String(errors[0]));
    }
    compileScript(descriptor, { id: "example", inlineTemplate: true });
    const template = compileTemplate({
      filename: "Example.vue",
      id: "example",
      source: descriptor.template?.content ?? "",
    });
    if (template.errors.length > 0) {
      throw new Error(String(template.errors[0]));
    }
  },
  web: () => undefined,
};

const BRONZE = ["--audio-shade", "oklch(0.62 0.06 60)"] as const;
const NEU: PlaygroundLook = { axes: [BRONZE], skin: "neu" };
const HARDWARE: PlaygroundLook = { axes: [], skin: "hardware" };
const LOOKS = [undefined, NEU, HARDWARE];

describe.each(Object.keys(PLAYGROUNDS) as PlaygroundName[])(
  "the %s's playground",
  (name) => {
    test("starts as the element's demo: its own defaults are left out", () => {
      const props = Object.fromEntries(propsOf(name, {}));
      expect(props).not.toHaveProperty("valueLabel");
      expect(props).not.toHaveProperty("orientation");
    });

    test.each(["react", "vue", "svelte"] as const)(
      "prints %s code that compiles, for every setting, in every look",
      (framework) => {
        for (const look of LOOKS) {
          for (const values of combinations(name)) {
            const { code } = codeOf(name, framework, values, look);
            expect(() => compiles[framework](code)).not.toThrow();
          }
        }
      }
    );

    test("prints markup with the parts the sheet styles, for every setting", () => {
      for (const values of combinations(name)) {
        const markup = webMarkup(name, values);
        expect(markup).toContain(`<audio-ui-${name} `);
        expect(markup).toContain(`data-size="${values.size}"`);
        expect(markup).not.toContain("undefined");
      }
    });
  }
);

test("a knob with no scale has no marks, and its readout hidden has no value", () => {
  const props = Object.fromEntries(
    propsOf("knob", { readout: "hidden", scale: "none" })
  );
  expect(props).not.toHaveProperty("marks");
  expect(props.valueLabel).toBe("hidden");
  expect(webMarkup("knob", { readout: "hidden", scale: "none" })).not.toContain(
    "knob-value"
  );
});

describe("the look in the code", () => {
  test.each(["react", "vue", "svelte", "web"] as const)(
    "%s's installs the skin with the CLI, as an item: its sheet joins the index",
    (framework) => {
      for (const look of [NEU, HARDWARE]) {
        expect(codeOf("knob", framework, {}, look).code).toContain(
          `npx @audio-ui/cli add knob skin-${look.skin}`
        );
      }
    }
  );

  test("React's sets the skin and its axes as classes on the element it draws as it is", () => {
    for (const look of [NEU, HARDWARE]) {
      const { code } = codeOf("meter", "react", {}, look);
      expect(code).toContain(
        `className="skin-${look.skin} audio-body rounded-2xl px-10 py-8`
      );
      expect(code).toContain(
        'import { Meter } from "@/components/audio-ui/meter"'
      );
    }
    expect(codeOf("knob", "react", {}, NEU).code).toContain(
      "[--audio-shade:oklch(0.62_0.06_60)]"
    );
  });

  test.each(["vue", "svelte", "web"] as const)(
    "%s's sets the skin on an element around it, the axes in its style",
    (framework) => {
      for (const look of [NEU, HARDWARE]) {
        expect(codeOf("fader", framework, {}, look).code).toContain(
          `class="skin-${look.skin} audio-body" style="padding: 2rem 2.5rem; border-radius: 1rem${look.axes.length > 0 ? "; --audio-shade: oklch(0.62 0.06 60)" : ""}"`
        );
      }
    }
  );
});
