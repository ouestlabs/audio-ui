import { $ } from "bun";

/**
 * Adds the knob, the fader and the meter to a Vite app of each framework, as
 * create-vite writes it, from the registry this repo builds, then runs the
 * app's own checks: vue-tsc, svelte-check, tsc and Vite's build. What a
 * project gets, checked by the tools it runs. This repo's TypeScript 7 has no
 * API for vue-tsc or svelte-check, so they run here, with each app's own.
 *
 * bun run test:consumers (after build:pkg). It installs from npm.
 */

const CREATE_VITE = "create-vite@9.4.0";
const CLI = `${import.meta.dir}/../dist/index.js`;
const REGISTRY = `${import.meta.dir}/../../../apps/www/public`;

const VUE_APP = `<script setup lang="ts">
import Fader from "./components/audio-ui/fader/Fader.vue";
import Knob from "./components/audio-ui/knob/Knob.vue";
import Meter from "./components/audio-ui/meter/Meter.vue";
</script>

<template>
  <Knob aria-label="Drive" :default-value="40" :marks="[0, { label: '50', value: 50 }, 100]" size="lg" />
  <Fader aria-label="Volume" :default-value="-6" :max="6" :min="-60" orientation="horizontal" />
  <Meter aria-label="Output" :marks="[0, -12, -24]" :value="[-12, -6]" />
</template>
`;

const SVELTE_APP = `<script lang="ts">
import Fader from "./lib/components/audio-ui/fader/Fader.svelte";
import Knob from "./lib/components/audio-ui/knob/Knob.svelte";
import Meter from "./lib/components/audio-ui/meter/Meter.svelte";
</script>

<Knob aria-label="Drive" defaultValue={40} marks={[0, { label: "50", value: 50 }, 100]} size="lg" />
<Fader aria-label="Volume" defaultValue={-6} max={6} min={-60} orientation="horizontal" />
<Meter aria-label="Output" marks={[0, -12, -24]} value={[-12, -6]} />
`;

const REACT_APP = `import { Fader } from "./components/audio-ui/fader";
import { Knob } from "./components/audio-ui/knob";
import { Meter } from "./components/audio-ui/meter";

export default function App() {
  return (
    <>
      <Knob aria-label="Drive" defaultValue={40} marks={[0, { label: "50", value: 50 }, 100]} size="lg" />
      <Fader aria-label="Volume" defaultValue={-6} max={6} min={-60} orientation="horizontal" />
      <Meter aria-label="Output" marks={[0, -12, -24]} value={[-12, -6]} />
    </>
  );
}
`;

interface App {
  /** The app's own checks, run once the components are in it. */
  check: (cwd: string) => ReturnType<typeof $>;
  /** What the app writes to use the components, over create-vite's files. */
  files: Record<string, string>;
  template: string;
}

const APPS: App[] = [
  {
    check: (cwd) => $`bun run build`.cwd(cwd),
    files: {
      "src/App.vue": VUE_APP,
      "src/main.ts": `import { createApp } from "vue";\nimport "./components/audio-ui/css/index.css";\nimport App from "./App.vue";\n\ncreateApp(App).mount("#app");\n`,
    },
    template: "vue-ts",
  },
  {
    check: (cwd) => $`bun run check && bun run build`.cwd(cwd),
    files: {
      "src/App.svelte": SVELTE_APP,
      "src/main.ts": `import { mount } from "svelte";\nimport "./lib/components/audio-ui/css/index.css";\nimport App from "./App.svelte";\n\nexport default mount(App, { target: document.getElementById("app") as HTMLElement });\n`,
    },
    template: "svelte-ts",
  },
  {
    check: (cwd) => $`bun run build`.cwd(cwd),
    files: { "src/App.tsx": REACT_APP },
    template: "react-ts",
  },
];

/** An app as create-vite writes it, the components added by the CLI, then its checks. Each step needs the one before. */
async function checkApp(folder: string, createVite: string, app: App) {
  const cwd = `${folder}/${app.template}`;
  await $`node ${createVite} ${app.template} --template ${app.template} --no-interactive`
    .cwd(folder)
    .quiet();
  await $`bun install`.cwd(cwd).quiet();
  await $`node ${CLI} add knob fader meter --registry ${REGISTRY}`
    .cwd(cwd)
    .quiet();
  await Promise.all(
    Object.entries(app.files).map(([path, content]) =>
      Bun.write(`${cwd}/${path}`, content)
    )
  );
  await app.check(cwd).quiet();
}

const failed = (error: unknown) =>
  error instanceof $.ShellError
    ? `${error.stdout.toString()}${error.stderr.toString()}`
    : String(error);

const workspace = (await $`mktemp -d`.text()).trim();
try {
  // One copy of create-vite writes every app: three `bunx` at once race on Bun's cache (ENOENT copying from it).
  const tools = `${workspace}/.tools`;
  await $`mkdir -p ${tools}`.quiet();
  await $`bun add ${CREATE_VITE}`.cwd(tools).quiet();
  const createVite = `${tools}/node_modules/create-vite/index.js`;
  const results = await Promise.allSettled(
    APPS.map((app) => checkApp(workspace, createVite, app))
  );
  for (const [index, result] of results.entries()) {
    const template = APPS[index]?.template;
    if (result.status === "fulfilled") {
      console.log(`${template}: checks and builds`);
    } else {
      console.error(`${template}: failed\n${failed(result.reason)}`);
      process.exitCode = 1;
    }
  }
} finally {
  await $`rm -rf ${workspace}`.quiet();
}
