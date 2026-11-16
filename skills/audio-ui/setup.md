# Setup

## Registry (shadcn)

`@audio-ui` is in shadcn's registry directory: there is no namespace to add to `components.json`. Run `npx shadcn@latest add @audio-ui/knob`. Requires React 19 and Tailwind CSS v4.

## Headless primitives only

The same registry installs the primitive of your framework alone, with no styles, one item per primitive and framework:

```bash
npx shadcn@latest add @audio-ui/knob-react
```

The suffix is the framework: `-react`, `-vue`, `-svelte` or `-web` (Vue, Svelte and the web install from the item's URL, `npx shadcn@latest add https://www.audio-ui.dev/r/styles/base-nova/knob-vue.json`, with a `components.json` and nothing else). The primitives are unstyled: `Knob`, `Fader`, `XYPad`, `Envelope`, `Meter`, `Plot`, `Waveform`, `Timeline`, `Sequencer`, `Piano`, `PianoRoll` and `Pad`. Their logic is `@audio-ui/primitives`, over `@audio-ui/core`, which the CLI adds to `package.json`.

## Another framework

Vue, Svelte and the web have the same primitives, as items of the registry (`knob-vue`, `knob-svelte`, `knob-web`): see the `core` skill. For a control of your own, or a framework with no adapter (Solid, Angular, Lit), `@audio-ui/core` has the framework-free controllers, with no dependency:

```bash
npm install @audio-ui/core
```

## MCP server

audio/ui runs a remote MCP server (Streamable HTTP, no auth): `https://www.audio-ui.dev/mcp`. Tools: `search_docs`, `list_components`, `get_component_docs`, `search_catalog`.

- Claude Code: `claude mcp add --transport http audio-ui https://www.audio-ui.dev/mcp`
- Cursor, VS Code and others: add a server of type `http` with that URL.
