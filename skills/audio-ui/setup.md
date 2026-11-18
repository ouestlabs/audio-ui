# Setup

## Registry (shadcn)

`@audio-ui` is in shadcn's registry directory: there is no namespace to add to `components.json`. Run `npx shadcn@latest add @audio-ui/knob`. Requires React 19 and Tailwind CSS v4.

## The engine

The audio logic (devices, musical time, analysis, pitch, MIDI, files, playback) is the engine, one registry item per module, installed to `lib/engine/<module>/` and imported from there: `npx shadcn@latest add @audio-ui/engine-time`, then `import { syncedSeconds } from "@/lib/engine/time"`. A component that needs a module installs it with itself.

## Headless primitives only

The same registry installs the primitive of your framework alone, with no styles, one item per primitive and framework:

```bash
npx shadcn@latest add @audio-ui/knob-react
```

The suffix is the framework: `-react`, `-vue`, `-svelte` or `-web` (Vue, Svelte and the web have no CLI: copy the files by hand from the item's URL, `https://www.audio-ui.dev/r/styles/ui-sdk-nova/knob-vue.json`, writing each entry of `files` under `components/audio-ui/`). The primitives are unstyled: `Knob`, `Fader`, `XYPad`, `Envelope`, `Meter`, `Plot`, `Waveform`, `Timeline`, `Sequencer`, `Piano`, `PianoRoll` and `Pad`. Each is one file written on the UI SDK kernel (`knob/knob.ts`, over `primitive.ts`), copied into your project with its adapter: nothing of ours comes from npm, and the only packages are the kernel's.

## Another framework

Vue, Svelte and the web have the same primitives, as items of the registry (`knob-vue`, `knob-svelte`, `knob-web`), copied by hand as above. A framework with no adapter (Solid, Angular, Lit) uses the web adapter: its custom elements (`audio-ui-knob`…) work in any page, registered once the file is imported.

## MCP server

audio/ui runs a remote MCP server (Streamable HTTP, no auth): `https://www.audio-ui.dev/mcp`. Tools: `search_docs`, `list_components`, `get_component_docs`, `search_catalog`.

- Claude Code: `claude mcp add --transport http audio-ui https://www.audio-ui.dev/mcp`
- Cursor, VS Code and others: add a server of type `http` with that URL.
