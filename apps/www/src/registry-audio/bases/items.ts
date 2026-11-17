import type { RegistryItem } from "shadcn/schema";
import {
  primitiveFiles,
  SHARED_ITEMS,
  SHIPPED_PRIMITIVES,
} from "./primitives.ts";

/**
 * The factories of registry items: every `_registry.ts` declares its items
 * through them, so a name, a file's path, where it installs and the type that
 * goes with it are written once, here, and never by hand.
 */

/** What an item says beyond its files: why it is there, and what it brings. */
export interface ItemSpec {
  /** Free-form search tags and the categories it is listed under. */
  categories?: string[];
  /** The npm packages its files import. */
  dependencies?: string[];
  description: string;
  /** Other items of the registry it needs, as `@audio-ui/<name>` or `@shadcn/<name>`. */
  registryDependencies?: string[];
}

/** The file types the factories make: a lib, a hook, or a component. */
type FileType =
  | "registry:component"
  | "registry:hook"
  | "registry:lib"
  | "registry:ui";

const fileOf = (path: string, type: FileType, target?: string) =>
  target ? { path, target, type } : { path, type };

/** An item of one file, or of several when `files` names more: a lib in `lib/`, a hook in `hooks/`. */
function flat(
  type: "registry:hook" | "registry:lib",
  folder: string,
  extension: string,
  name: string,
  { files, ...spec }: ItemSpec & { files?: string[] }
): RegistryItem {
  return {
    categories: spec.categories,
    dependencies: spec.dependencies ?? [],
    description: spec.description,
    files: (files ?? [`${folder}/${name}.${extension}`]).map((path) =>
      fileOf(path, type)
    ),
    name,
    registryDependencies: spec.registryDependencies ?? [],
    type,
  };
}

/** A lib: framework-free logic in `lib/<name>.ts`, installed to `lib/`. */
export const libItem = (
  name: string,
  spec: ItemSpec & { files?: string[] }
): RegistryItem => flat("registry:lib", "lib", "ts", name, spec);

/** A hook: React integration in `hooks/<name>.ts`, installed to `hooks/`. */
export const hookItem = (
  name: string,
  spec: ItemSpec & { files?: string[] }
): RegistryItem => flat("registry:hook", "hooks", "ts", name, spec);

/** A part of a device: what its file needs beyond the device's own state. */
export interface DevicePartSpec {
  /** The npm packages its file imports. */
  dependencies?: string[];
  description: string;
  /** Other items it needs besides the device's state, which every part but the state gets anyway. */
  registryDependencies?: string[];
}

/** Where a device's file sits and installs: `devices/<name>/<file>` to `components/audio-ui/devices/<name>/`. */
const deviceFile = (name: string, file: string, type: FileType) =>
  fileOf(
    `devices/${name}/${file}`,
    type,
    `components/audio-ui/devices/${name}/${file}`
  );

/**
 * A device as the registry ships it: four items from one description.
 *
 * - `<name>-device`: its state, `devices/<name>/device.ts` (and the source of
 *   its worklet, over `@audio-ui/engine/kernels`, when it runs one), no panel
 *   and no audio
 * - `<name>-engine`: its Web Audio engine, `engine.ts`, over the state and
 *   `@audio-ui/engine/device` (the contract it returns)
 * - `<name>-panel`: its face, `panel.tsx`, over `device-panel` and the state
 * - `<name>`: all three in one install
 *
 * `tags` are search tags the state and the engine carry besides `lib`,
 * `audio` and `device`, such as `synth`.
 */
export function deviceItems(
  name: string,
  {
    device,
    engine,
    panel,
    tags = [],
  }: {
    device: DevicePartSpec;
    engine: DevicePartSpec;
    panel: DevicePartSpec & { categories: string[] };
    tags?: string[];
  }
): RegistryItem[] {
  const categories = ["lib", "audio", "device", ...tags];
  const state = `@audio-ui/${name}-device`;
  return [
    {
      categories,
      dependencies: device.dependencies ?? [],
      description: device.description,
      files: [deviceFile(name, "device.ts", "registry:lib")],
      name: `${name}-device`,
      registryDependencies: device.registryDependencies ?? [],
      type: "registry:lib",
    },
    {
      categories,
      dependencies: engine.dependencies ?? [],
      description: engine.description,
      files: [deviceFile(name, "engine.ts", "registry:lib")],
      name: `${name}-engine`,
      registryDependencies: [...(engine.registryDependencies ?? []), state],
      type: "registry:lib",
    },
    {
      categories: panel.categories,
      dependencies: panel.dependencies ?? [],
      description: panel.description,
      files: [deviceFile(name, "panel.tsx", "registry:ui")],
      name: `${name}-panel`,
      registryDependencies: [
        "@audio-ui/device-panel",
        ...(panel.registryDependencies ?? []),
        state,
      ],
      type: "registry:ui",
    },
    {
      categories: ["device"],
      description: `The ${name.replaceAll("-", " ")} device in one install: its state, its Web Audio engine and its panel, to components/audio-ui/devices/${name}/.`,
      files: [],
      name,
      registryDependencies: [
        state,
        `@audio-ui/${name}-engine`,
        `@audio-ui/${name}-panel`,
      ],
      type: "registry:ui",
    },
  ];
}

/**
 * A lib that moved into `@audio-ui/engine`: its old install name still
 * answers, with the package in place of the file, so a project that adds it
 * gets the code it was after.
 */
export function movedItem(name: string, module: string): RegistryItem {
  return {
    dependencies: ["@audio-ui/engine"],
    description: `Moved: ${name} is part of @audio-ui/engine now, imported from @audio-ui/engine/${module}.`,
    files: [],
    name,
    registryDependencies: [],
    type: "registry:lib",
  };
}

/**
 * The kernel's version, in every item that imports it. `latest` on npm is
 * an older beta than the one the primitives are written for, so a bare name
 * would install the wrong one.
 */
const UI_SDK = "0.1.0-beta.5";

/** The frameworks a primitive is rendered in, with the files each one installs. */
export interface PrimitiveFramework {
  /** The npm packages its files import, besides the primitive's. */
  dependencies: string[];
  /** Its files, relative to the primitive's folder in `primitives/<name>/`. */
  files: string[];
  name: "react" | "svelte" | "vue" | "web";
}

/**
 * A primitive as the registry ships it: one item per framework,
 * `<name>-<framework>`, from the adapter files in `primitives/<name>/`. Each
 * installs to `components/audio-ui/<name>/`. A primitive written in the
 * registry ships in each of its items, beside the adapter, so the user owns
 * both; the others still render `@audio-ui/primitives`.
 */
const ADAPTER_INDEX = /^(react|vue|web)\/index(\.\w+)$/;

export function primitiveItems(
  name: string,
  frameworks: PrimitiveFramework[],
  description: string
): RegistryItem[] {
  // A primitive written in the registry ships in each item: no package of ours.
  const ships = SHIPPED_PRIMITIVES.has(name);
  return frameworks.map((framework) => {
    // shadcn-svelte puts a `registry:ui` file under its own `ui` folder, and
    // a `registry:component` one in `components`, which is where it belongs.
    const svelte = framework.name === "svelte";
    const type = svelte ? "registry:component" : "registry:ui";
    // Both CLIs write a `~/` target from the project's root: `src/lib/components`, where shadcn-svelte keeps its own.
    const root = svelte ? "~/src/lib/components/" : "components/";
    return {
      categories: ["primitive", framework.name],
      dependencies: [
        ...(ships ? [] : ["@audio-ui/primitives"]),
        `@ui-sdk/core@${UI_SDK}`,
        ...framework.dependencies
          .filter(
            (dependency) => !(ships && dependency.startsWith("@audio-ui/"))
          )
          .map((dependency) =>
            dependency.startsWith("@ui-sdk/")
              ? `${dependency}@${UI_SDK}`
              : dependency
          ),
      ],
      description: `${description} Its ${framework.name} adapter${ships ? ", with the primitive it renders" : ""}.`,
      files: [
        ...(ships ? primitiveFiles(name) : []).map((file) =>
          fileOf(`primitives/${file}`, type, `${root}audio-ui/${file}`)
        ),
        ...framework.files.map((file) =>
          fileOf(
            `primitives/${name}/${file}`,
            type,
            // Installed as `audio-ui/<name>/react.tsx`: the folder of an adapter in the registry is its source's alone.
            `${root}audio-ui/${name}/${file.replace(ADAPTER_INDEX, "$1$2")}`
          )
        ),
      ],
      name: `${name}-${framework.name}`,
      registryDependencies: [],
      type,
    };
  });
}

/**
 * The files the rest of the registry reads of the primitives, one item each:
 * installed to `components/audio-ui/`, where the adapters write the same
 * files, which the CLI skips as identical.
 */
export function sharedItems(): RegistryItem[] {
  return Object.entries(SHARED_ITEMS).map(([name, item]) => ({
    categories: ["primitive"],
    dependencies: item.uiSdk ? [`@ui-sdk/core@${UI_SDK}`] : [],
    description: item.description,
    files: item.files.map((file) =>
      fileOf(`primitives/${file}`, "registry:ui", `components/audio-ui/${file}`)
    ),
    name,
    type: "registry:ui",
  }));
}
