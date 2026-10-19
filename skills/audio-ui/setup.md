# Setup

## Registry (shadcn)

Add the namespace to `components.json` once, with the CLI:

```bash
npx shadcn@latest registry add "@audio-ui=https://www.audio-ui.dev/r/{style}/{name}.json"
```

or by hand:

```json
{
  "registries": {
    "@audio-ui": "https://www.audio-ui.dev/r/{style}/{name}.json"
  }
}
```

Then `npx shadcn@latest add @audio-ui/knob`. Requires React 19 and Tailwind CSS v4.

## Package only

```bash
npm install @audio-ui/react
```

Primitives are unstyled and export `Knob`, `Fader`, `XYPad`, `Envelope`, `Meter`, `Plot`, `Waveform`, `Timeline`, `Sequencer`, `Piano` and `PianoRoll`. Peer dependencies: `react` and `react-dom` 19.

## Without React

```bash
npm install @audio-ui/core
```

No dependencies. The framework-free controllers of every primitive, for Vue, Svelte, Solid, Angular, web components or the plain DOM: see the `core` skill.

## MCP server

audio/ui runs a remote MCP server (Streamable HTTP, no auth): `https://www.audio-ui.dev/mcp`. Tools: `search_docs`, `list_components`, `get_component_docs`, `search_catalog`.

- Claude Code: `claude mcp add --transport http audio-ui https://www.audio-ui.dev/mcp`
- Cursor, VS Code and others: add a server of type `http` with that URL.
