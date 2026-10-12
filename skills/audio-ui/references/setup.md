# Setup

## Registry (shadcn)

Add the namespace to `components.json` once:

```json
{
  "registries": {
    "@audio": "https://audio-ui.dev/r/{style}/{name}.json"
  }
}
```

Then `npx shadcn@latest add @audio/knob`. Requires React 19 and Tailwind CSS v4.

## Package only

```bash
npm install @audio-ui/react
```

Primitives are unstyled and export `Knob`, `Fader`, `XYPad`, `Envelope`, `Meter`, `Plot`, `Waveform`, `Timeline`, `Sequencer`, `Piano` and `PianoRoll`. Peer dependencies: `react` and `react-dom` 19.

## MCP server

audio/ui runs a remote MCP server (Streamable HTTP, no auth): `https://audio-ui.dev/mcp`. Tools: `list_components`, `get_component_docs`, `search_catalog`.

- Claude Code: `claude mcp add --transport http audio-ui https://audio-ui.dev/mcp`
- Cursor, VS Code and others: add a server of type `http` with that URL.
