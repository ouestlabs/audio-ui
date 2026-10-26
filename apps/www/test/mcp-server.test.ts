import { afterAll, describe, expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import "./fixtures/agent-docs";

const { createAudioUiMcpServer } = await import("@/lib/agents/mcp-server");

// The MCP tools and the REST API answer from the same queries: a client
// talks to the server here, as an agent would.
const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
const server = createAudioUiMcpServer();
const client = new Client({ name: "test", version: "1.0.0" });
await server.connect(serverSide);
await client.connect(clientSide);

afterAll(() => client.close());

async function call(name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({ arguments: args, name });
  const [content] = result.content as { text: string }[];
  return { isError: result.isError === true, text: content?.text ?? "" };
}

describe("the MCP server", () => {
  test("list_components answers the components, one kind if asked", async () => {
    const all = JSON.parse((await call("list_components")).text);
    expect(all.map((c: { name: string }) => c.name)).toEqual([
      "knob",
      "compressor",
    ]);
    expect(all[0]).toEqual({
      description: "A rotary control.",
      docs: expect.stringContaining("/docs/components/base/knob"),
      install: "npx shadcn@latest add @audio-ui/knob",
      kind: "elements",
      name: "knob",
      title: "Knob",
    });
    const devices = JSON.parse(
      (await call("list_components", { kind: "devices" })).text
    );
    expect(devices.map((c: { name: string }) => c.name)).toEqual([
      "compressor",
    ]);
  });

  test("search_docs answers the matching sections", async () => {
    const { hits } = JSON.parse(
      (await call("search_docs", { query: "log scale" })).text
    );
    expect(hits[0]).toEqual(
      expect.objectContaining({ component: "knob", section: "api-reference" })
    );
  });

  test("get_component_docs answers the page, or one section", async () => {
    expect((await call("get_component_docs", { name: "knob" })).text).toContain(
      "# Knob"
    );
    const part = await call("get_component_docs", {
      name: "knob",
      section: "installation",
    });
    expect(part.text).toContain("Run the command.");
    expect(part.text).not.toContain("log scale");
  });

  test("get_component_docs names the nearest component, or the sections", async () => {
    const name = await call("get_component_docs", { name: "knobb" });
    expect(name.isError).toBe(true);
    expect(name.text).toBe(
      "No component named 'knobb'. Did you mean: knob? Use search_docs to find a component by what it does, or list_components to browse."
    );
    const section = await call("get_component_docs", {
      name: "knob",
      section: "pricing",
    });
    expect(section.isError).toBe(true);
    expect(section.text).toStartWith(
      "No section 'pricing' in knob. Sections: "
    );
  });

  test("search_catalog answers a page of blocks", async () => {
    const page = JSON.parse(
      (await call("search_catalog", { query: "synth" })).text
    );
    expect(page).toEqual({
      has_more: false,
      items: [expect.objectContaining({ name: "block-pocket-synth" })],
      total: 1,
    });
  });
});
