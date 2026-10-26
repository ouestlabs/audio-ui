import { siteConfig } from "@/lib/config";
import { BUILT_STYLES, DEFAULT_STYLE } from "@/lib/registry/core/styles";

const NAME_PATTERN = "^[a-z0-9]+(?:-[a-z0-9]+)*$";

const redirect = (to: string) => ({
  description: `Redirects to ${to}, the address of the current deployment. Follow it to get the file.`,
  headers: {
    Location: {
      description: "The address to request instead.",
      schema: { format: "uri", type: "string" },
    },
  },
});

const markdown = (description: string) => ({
  content: { "text/markdown": { schema: { type: "string" } } },
  description,
});

const markdownNotFound = {
  content: {
    "application/json": { schema: { $ref: "#/components/schemas/Error" } },
    "text/markdown": { schema: { type: "string" } },
  },
  description:
    "No docs page at this address. The body says so and links to llms.txt; JSON when the request asks for application/json.",
};

const registryNotFound = {
  content: {
    "application/json": { schema: { $ref: "#/components/schemas/Error" } },
  },
  description:
    "The registry has no file at this address: the message names what is missing, the hint where to look.",
};

const pageParameter = (description: string, example: string) => ({
  description,
  example,
  in: "path",
  name: "page",
  required: true,
  schema: { pattern: NAME_PATTERN, type: "string" },
});

/**
 * `/openapi.json`: what the site serves to programs, as OpenAPI 3.1. The
 * registry the shadcn CLI installs from, every docs page as markdown, the
 * llms.txt files and the MCP server. All of it is public, read-only and
 * needs no key.
 */
export function getOpenApiDocument() {
  const { url } = siteConfig;
  return {
    components: {
      parameters: {
        deployment: {
          description:
            "The deployment the file belongs to. Without it the server redirects (307) to the address that carries the current one; with it the file is served and cached for good. Any value is accepted.",
          in: "query",
          name: "v",
          required: false,
          schema: { type: "string" },
        },
        name: {
          description:
            "The item's name, as in `npx shadcn@latest add @audio-ui/<name>`. The registry index (getRegistryIndex) lists them all.",
          example: "knob",
          in: "path",
          name: "name",
          required: true,
          schema: { pattern: NAME_PATTERN, type: "string" },
        },
        style: {
          description: "A style the registry is built in.",
          example: DEFAULT_STYLE,
          in: "path",
          name: "style",
          required: true,
          schema: { enum: BUILT_STYLES, type: "string" },
        },
      },
      schemas: {
        Error: {
          description:
            "An error. `error` is a stable code, `message` says what went wrong and `hint` what to do next.",
          properties: {
            error: { enum: ["not_found", "not_acceptable"], type: "string" },
            hint: { type: "string" },
            message: { type: "string" },
            status: { description: "The HTTP status.", type: "integer" },
          },
          required: ["error", "message", "hint", "status"],
          type: "object",
        },
        JsonRpcRequest: {
          description:
            "A JSON-RPC 2.0 request or notification, such as `tools/list` or `tools/call`.",
          properties: {
            id: { type: ["string", "integer"] },
            jsonrpc: { const: "2.0", type: "string" },
            method: { example: "tools/list", type: "string" },
            params: { type: "object" },
          },
          required: ["jsonrpc", "method"],
          type: "object",
        },
        JsonRpcResponse: {
          description: "A JSON-RPC 2.0 response: a result or an error.",
          properties: {
            error: {
              properties: {
                code: { type: "integer" },
                data: {},
                message: { type: "string" },
              },
              required: ["code", "message"],
              type: "object",
            },
            id: { type: ["string", "integer", "null"] },
            jsonrpc: { const: "2.0", type: "string" },
            result: { type: "object" },
          },
          required: ["jsonrpc", "id"],
          type: "object",
        },
        RegistryFile: {
          properties: {
            content: {
              description: "The file's source, ready to write.",
              type: "string",
            },
            path: {
              description: "The file's path in the registry.",
              type: "string",
            },
            target: {
              description:
                "Where the shadcn CLI writes it in a project, such as components/audio-ui/knob.tsx.",
              type: "string",
            },
            type: { example: "registry:ui", type: "string" },
          },
          required: ["path", "type"],
          type: "object",
        },
        RegistryIndex: {
          description:
            "Every item of the registry, without the files' content. Follows the shadcn registry schema.",
          properties: {
            $schema: { format: "uri", type: "string" },
            homepage: { format: "uri", type: "string" },
            items: {
              items: { $ref: "#/components/schemas/RegistryItem" },
              type: "array",
            },
            name: { const: "audio-ui", type: "string" },
          },
          required: ["name", "homepage", "items"],
          type: "object",
        },
        RegistryItem: {
          additionalProperties: true,
          description:
            "A component, block, hook or lib, with the source of its files. Follows the shadcn registry-item schema (https://ui.shadcn.com/schema/registry-item.json).",
          properties: {
            $schema: { format: "uri", type: "string" },
            cssVars: {
              description: "CSS variables the item adds to the theme.",
              type: "object",
            },
            dependencies: {
              description: "npm packages to install.",
              items: { type: "string" },
              type: "array",
            },
            description: { type: "string" },
            files: {
              items: { $ref: "#/components/schemas/RegistryFile" },
              type: "array",
            },
            name: { type: "string" },
            registryDependencies: {
              description:
                "Other registry items it needs, such as @audio-ui/knob or @shadcn/button.",
              items: { type: "string" },
              type: "array",
            },
            type: {
              enum: [
                "registry:ui",
                "registry:block",
                "registry:example",
                "registry:hook",
                "registry:lib",
              ],
              type: "string",
            },
          },
          required: ["name", "type"],
          type: "object",
        },
        Style: {
          properties: {
            label: { example: "Base Nova", type: "string" },
            name: { example: DEFAULT_STYLE, type: "string" },
          },
          required: ["name", "label"],
          type: "object",
        },
      },
    },
    externalDocs: {
      description: "The docs, each page also served as markdown under /llm.",
      url: `${url}/docs`,
    },
    info: {
      contact: {
        email: siteConfig.email,
        name: "Ouest Labs",
        url: `${url}/contact`,
      },
      description: `The public, read-only HTTP surface of ${siteConfig.name}: the shadcn registry of audio components, the docs as markdown and the MCP server. No key, no account.

The registry has one address per file: \`/r/styles/{style}/{name}.json?v={deployment}\`. The shorter addresses, \`/r/{name}.json\` and \`/r/{style}/{name}.json\` (the one the shadcn CLI uses), and any address without \`v\`, redirect there with a 307. Follow redirects.`,
      license: { identifier: "MIT", name: "MIT" },
      summary:
        "The audio/ui registry, docs and MCP server, for programs and agents.",
      title: `${siteConfig.name} registry and docs`,
      version: "1.0.0",
    },
    openapi: "3.1.0",
    paths: {
      "/llm": {
        get: {
          description:
            "The docs introduction as markdown: the two layers, how to install and where to go next.",
          operationId: "getDocsIntroduction",
          responses: { "200": markdown("The page, as markdown.") },
          summary: "Read the docs introduction",
          tags: ["Docs"],
        },
      },
      "/llm/components/base/{name}": {
        get: {
          description:
            "A component's docs page as markdown: what it is, how to install it, its usage, its API reference and examples. Read it before writing code with the component.",
          operationId: "getComponentDocs",
          parameters: [{ $ref: "#/components/parameters/name" }],
          responses: {
            "200": markdown("The page, as markdown."),
            "404": markdownNotFound,
          },
          summary: "Read a component's docs",
          tags: ["Docs"],
        },
      },
      "/llm/engine/{page}": {
        get: {
          description:
            "A page of the audio engine docs as markdown: the hooks and libs that make the sound (output, clock and time, synthesis, input, analysis).",
          operationId: "getEngineDocs",
          parameters: [
            pageParameter(
              "The page: output, clock-and-time, synthesis, demo-sounds, input, analysis or controllers.",
              "clock-and-time"
            ),
          ],
          responses: {
            "200": markdown("The page, as markdown."),
            "404": markdownNotFound,
          },
          summary: "Read an audio engine page",
          tags: ["Docs"],
        },
      },
      "/llm/{page}": {
        get: {
          description:
            "A guide as markdown, such as get-started, registry, primitives, styling, mcp, agents or engine. llms.txt lists them all.",
          operationId: "getGuide",
          parameters: [
            pageParameter("The guide's address under /docs.", "get-started"),
          ],
          responses: {
            "200": markdown("The page, as markdown."),
            "404": markdownNotFound,
          },
          summary: "Read a guide",
          tags: ["Docs"],
        },
      },
      "/llms-full.txt": {
        get: {
          description:
            "Every docs page in one markdown file. Large: prefer llms.txt and the pages it links to.",
          operationId: "getLlmsFullTxt",
          responses: {
            "200": {
              content: { "text/plain": { schema: { type: "string" } } },
              description: "The docs, as markdown.",
            },
          },
          summary: "Read all the docs at once",
          tags: ["Docs"],
        },
      },
      "/llms.txt": {
        get: {
          description:
            "The map of the docs (llmstxt.org): when to use audio/ui, how to install it, and a link to every page as markdown.",
          operationId: "getLlmsTxt",
          responses: {
            "200": {
              content: { "text/plain": { schema: { type: "string" } } },
              description: "The llms.txt file, in markdown.",
            },
          },
          summary: "Read the map of the docs",
          tags: ["Docs"],
        },
      },
      "/mcp": {
        post: {
          description: `The MCP server, over Streamable HTTP without sessions. Its tools are list_components, search_docs, get_component_docs and search_catalog. Send one JSON-RPC message per request; the reply is JSON. An MCP client is the easy way in: \`claude mcp add --transport http audio-ui ${url}/mcp\`.`,
          externalDocs: {
            description: "The MCP specification",
            url: "https://modelcontextprotocol.io/specification",
          },
          operationId: "callMcp",
          parameters: [
            {
              description:
                "Must accept both application/json and text/event-stream, as the MCP transport requires.",
              in: "header",
              name: "Accept",
              required: true,
              schema: {
                example: "application/json, text/event-stream",
                type: "string",
              },
            },
          ],
          requestBody: {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/JsonRpcRequest" },
              },
            },
            required: true,
          },
          responses: {
            "200": {
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/JsonRpcResponse" },
                },
              },
              description: "The JSON-RPC response.",
            },
            "202": {
              description: "A notification, accepted. No body.",
            },
            "406": {
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/JsonRpcResponse" },
                },
              },
              description:
                "The Accept header does not take both application/json and text/event-stream.",
            },
          },
          summary: "Call the MCP server",
          tags: ["Agents"],
        },
      },
      "/r/styles/index.json": {
        get: {
          description: "The styles the registry is built in.",
          operationId: "listRegistryStyles",
          parameters: [{ $ref: "#/components/parameters/deployment" }],
          responses: {
            "200": {
              content: {
                "application/json": {
                  schema: {
                    items: { $ref: "#/components/schemas/Style" },
                    type: "array",
                  },
                },
              },
              description: "The styles.",
            },
            "307": redirect("/r/styles/index.json?v={deployment}"),
          },
          summary: "List the registry's styles",
          tags: ["Registry"],
        },
      },
      "/r/styles/{style}/registry.json": {
        get: {
          description:
            "Every component, block, hook and lib of the registry, with its type, description and dependencies. Find a name here, then get the item.",
          operationId: "getRegistryIndex",
          parameters: [
            { $ref: "#/components/parameters/style" },
            { $ref: "#/components/parameters/deployment" },
          ],
          responses: {
            "200": {
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/RegistryIndex" },
                },
              },
              description: "The registry index.",
            },
            "307": redirect("/r/styles/{style}/registry.json?v={deployment}"),
            "404": registryNotFound,
          },
          summary: "List the registry's items",
          tags: ["Registry"],
        },
      },
      "/r/styles/{style}/{name}.json": {
        get: {
          description:
            "A registry item with the source of its files, as the shadcn CLI installs it. To install it in a project, prefer running `npx shadcn@latest add @audio-ui/<name>`.",
          operationId: "getRegistryItem",
          parameters: [
            { $ref: "#/components/parameters/style" },
            { $ref: "#/components/parameters/name" },
            { $ref: "#/components/parameters/deployment" },
          ],
          responses: {
            "200": {
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/RegistryItem" },
                },
              },
              description: "The item.",
            },
            "307": redirect("/r/styles/{style}/{name}.json?v={deployment}"),
            "404": registryNotFound,
          },
          summary: "Get a registry item",
          tags: ["Registry"],
        },
      },
      "/r/{name}.json": {
        get: {
          description: `A registry item in the default style, ${DEFAULT_STYLE}. Always redirects to getRegistryItem.`,
          operationId: "resolveRegistryItem",
          parameters: [{ $ref: "#/components/parameters/name" }],
          responses: {
            "307": redirect(
              `/r/styles/${DEFAULT_STYLE}/{name}.json?v={deployment}`
            ),
          },
          summary: "Find an item in the default style",
          tags: ["Registry"],
        },
      },
      "/r/{style}/{name}.json": {
        get: {
          description: `The address the shadcn CLI installs from. A style the registry does not build gets ${DEFAULT_STYLE}. Always redirects to getRegistryItem.`,
          operationId: "resolveStyledRegistryItem",
          parameters: [
            {
              description:
                "The project's style, from its components.json, such as base-nova or new-york.",
              example: DEFAULT_STYLE,
              in: "path",
              name: "style",
              required: true,
              schema: { type: "string" },
            },
            { $ref: "#/components/parameters/name" },
          ],
          responses: {
            "307": redirect("/r/styles/{style}/{name}.json?v={deployment}"),
          },
          summary: "Find an item in a project's style",
          tags: ["Registry"],
        },
      },
    },
    // Public: no operation asks for a key.
    security: [],
    servers: [{ description: "Production", url }],
    tags: [
      {
        description: "The shadcn registry: components, blocks, hooks and libs.",
        name: "Registry",
      },
      { description: "The docs, as markdown.", name: "Docs" },
      { description: "The MCP server for AI agents.", name: "Agents" },
    ],
  };
}
