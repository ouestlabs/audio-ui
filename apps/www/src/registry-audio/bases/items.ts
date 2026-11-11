import type { RegistryItem } from "shadcn/schema";

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
type FileType = "registry:hook" | "registry:lib" | "registry:ui";

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
 * - `<name>-device`: its state, `devices/<name>/device.ts` (and `kernels.ts`
 *   when its engine runs audio.js kernels in a worklet), no panel and no audio
 * - `<name>-engine`: its Web Audio engine, `engine.ts`, over the state and
 *   `device-engine` (the contract it returns)
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
    device: DevicePartSpec & { kernels?: boolean };
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
      files: [
        deviceFile(name, "device.ts", "registry:lib"),
        ...(device.kernels
          ? [deviceFile(name, "kernels.ts", "registry:lib")]
          : []),
      ],
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
      registryDependencies: [
        "@audio-ui/device-engine",
        ...(engine.registryDependencies ?? []),
        state,
      ],
      type: "registry:lib",
    },
    {
      categories: panel.categories,
      dependencies: ["@audio-ui/react", ...(panel.dependencies ?? [])],
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
