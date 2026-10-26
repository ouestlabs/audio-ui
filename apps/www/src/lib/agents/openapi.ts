import {
  API_BASE,
  API_DOCS,
  API_VERSION,
  RATE_LIMIT,
} from "@/lib/agents/rest-api";
import { siteConfig } from "@/lib/config";
import { BUILT_STYLES, DEFAULT_STYLE } from "@/lib/registry/core/styles";

const NAME_PATTERN = "^[a-z0-9]+(?:-[a-z0-9]+)*$";

/** The paths outside the REST API are served from the site's root. */
const SITE = [{ description: "The site", url: siteConfig.url }];

const json = (schema: string) => ({
  "application/json": { schema: { $ref: `#/components/schemas/${schema}` } },
});

/** A success of the REST API: its body, and the headers that announce a deprecation. */
const apiAnswer = (description: string, schema: string) => ({
  content: json(schema),
  description,
  headers: {
    Deprecation: { $ref: "#/components/headers/Deprecation" },
    "RateLimit-Policy": { $ref: "#/components/headers/RateLimit-Policy" },
    Sunset: { $ref: "#/components/headers/Sunset" },
  },
});

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
  content: { "text/markdown": { schema: { type: "string" } } },
  description:
    "No docs page at this address. The body says so and links to llms.txt.",
};

const registryNotFound = {
  content: json("Error"),
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

const VERSIONING = `## Versioning and deprecation

The REST API is versioned in its path: \`/api/${API_VERSION}\`. Within a version, changes only add: new endpoints, new optional parameters, new fields in the answers. A client ignores the fields it does not know. A change that could break a client (removing or renaming an endpoint, a parameter or a field, or changing what one means) ships as a new version, \`/api/v2\`, and \`/api/${API_VERSION}\` keeps answering beside it.

An operation is deprecated at least six months before it is removed. From that day its answers carry a \`Deprecation\` header (RFC 9745) with the date it was deprecated and a \`Sunset\` header (RFC 8594) with the date after which it may stop answering, its entry here is marked \`deprecated\`, and ${API_DOCS} says what replaces it. Nothing is deprecated today.

## Rate limits

Each client address may send ${RATE_LIMIT.quota} requests every ${RATE_LIMIT.window} seconds, counted in each Cloudflare location and approximately. Every answer of the API states it in a \`RateLimit-Policy\` header (draft-ietf-httpapi-ratelimit-headers): \`"api";q=${RATE_LIMIT.quota};w=${RATE_LIMIT.window}\`. Past it, the API answers 429 with \`RateLimit: "api";r=0;t=${RATE_LIMIT.window}\` and a \`Retry-After\` header in seconds: wait that long before asking again.

The registry, the markdown docs, llms.txt and the MCP server follow their own formats (the shadcn registry schema, llmstxt.org, the MCP protocol version) and are not versioned by this policy.`;

/**
 * `/openapi.json`: what the site serves to programs, as OpenAPI 3.1. The
 * REST API first, then the registry the shadcn CLI installs from, every docs
 * page as markdown, the llms.txt files and the MCP server. All of it is
 * public, read-only and needs no key.
 */
export function getOpenApiDocument() {
  const { url } = siteConfig;
  return {
    components: {
      headers: {
        Deprecation: {
          description:
            "Sent once the operation is deprecated (RFC 9745): the moment it was, as `@` and a Unix time. Absent while the operation is current.",
          schema: { example: "@1798761600", type: "string" },
        },
        RateLimit: {
          description:
            "Sent on a 429 (draft-ietf-httpapi-ratelimit-headers): the quota left in the policy, none, and the seconds until the window ends.",
          schema: {
            example: `"api";r=0;t=${RATE_LIMIT.window}`,
            type: "string",
          },
        },
        "RateLimit-Policy": {
          description:
            "On every answer of the API (draft-ietf-httpapi-ratelimit-headers): the quota of a client address, in requests (q), and its window, in seconds (w).",
          schema: {
            example: `"api";q=${RATE_LIMIT.quota};w=${RATE_LIMIT.window}`,
            type: "string",
          },
        },
        "Retry-After": {
          description:
            "Sent on a 429 (RFC 9110): the seconds to wait before asking again.",
          schema: { example: String(RATE_LIMIT.window), type: "string" },
        },
        Sunset: {
          description:
            "Sent with Deprecation (RFC 8594): the HTTP date after which the operation may stop answering, at least six months after its deprecation.",
          schema: { example: "Thu, 01 Jul 2027 00:00:00 GMT", type: "string" },
        },
      },
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
      responses: {
        InvalidParameter: {
          content: json("Error"),
          description:
            "A query parameter is missing or out of range: the message names it and says what it takes.",
        },
        MethodNotAllowed: {
          content: json("Error"),
          description:
            "The API only reads: anything but GET and HEAD is refused, with the Allow header.",
        },
        TooManyRequests: {
          content: json("Error"),
          description: `This address sent more than ${RATE_LIMIT.quota} requests in ${RATE_LIMIT.window} seconds. Wait for Retry-After.`,
          headers: {
            RateLimit: { $ref: "#/components/headers/RateLimit" },
            "RateLimit-Policy": {
              $ref: "#/components/headers/RateLimit-Policy",
            },
            "Retry-After": { $ref: "#/components/headers/Retry-After" },
          },
        },
      },
      schemas: {
        ApiRoot: {
          description:
            "The entry point of the REST API: its version and where every endpoint is, as URI templates (RFC 6570).",
          properties: {
            docs: { format: "uri", type: "string" },
            endpoints: {
              additionalProperties: { type: "string" },
              type: "object",
            },
            name: { type: "string" },
            openapi: { format: "uri", type: "string" },
            status: { enum: ["current", "deprecated"], type: "string" },
            version: { example: API_VERSION, type: "string" },
          },
          required: ["name", "version", "status", "endpoints"],
          type: "object",
        },
        ApiVersions: {
          properties: {
            docs: { format: "uri", type: "string" },
            openapi: { format: "uri", type: "string" },
            versions: {
              items: {
                properties: {
                  status: { enum: ["current", "deprecated"], type: "string" },
                  url: { format: "uri", type: "string" },
                  version: { type: "string" },
                },
                required: ["version", "url", "status"],
                type: "object",
              },
              type: "array",
            },
          },
          required: ["versions"],
          type: "object",
        },
        CatalogItem: {
          properties: {
            categories: { items: { type: "string" }, type: "array" },
            description: { type: "string" },
            install: {
              example: "npx shadcn@latest add @audio-ui/block-pocket-synth",
              type: "string",
            },
            name: { type: "string" },
            title: { type: "string" },
          },
          required: ["name", "title", "install"],
          type: "object",
        },
        CatalogPage: {
          description:
            "One page of the catalog. When has_more is true, ask again with offset set to next_offset.",
          properties: {
            has_more: { type: "boolean" },
            items: {
              items: { $ref: "#/components/schemas/CatalogItem" },
              type: "array",
            },
            next_offset: { type: "integer" },
            total: { type: "integer" },
          },
          required: ["items", "total", "has_more"],
          type: "object",
        },
        Component: {
          description: "A component: what it is and how to install it.",
          properties: {
            api_url: { format: "uri", type: "string" },
            description: { type: "string" },
            docs: {
              description: "Its docs page.",
              format: "uri",
              type: "string",
            },
            install: {
              example: "npx shadcn@latest add @audio-ui/knob",
              type: "string",
            },
            kind: {
              enum: ["elements", "workstation", "devices"],
              type: "string",
            },
            markdown_url: {
              description: "Its docs page as markdown.",
              format: "uri",
              type: "string",
            },
            name: { example: "knob", type: "string" },
            title: { type: "string" },
          },
          required: [
            "name",
            "title",
            "description",
            "docs",
            "install",
            "api_url",
            "markdown_url",
          ],
          type: "object",
        },
        ComponentDocs: {
          allOf: [
            { $ref: "#/components/schemas/Component" },
            {
              properties: {
                markdown: {
                  description: "The docs page, or the section asked for.",
                  type: "string",
                },
                section: { type: ["string", "null"] },
                sections: {
                  description: "The sections of the page, to ask for one.",
                  items: { type: "string" },
                  type: "array",
                },
              },
              required: ["markdown", "section", "sections"],
              type: "object",
            },
          ],
        },
        ComponentList: {
          properties: {
            components: {
              items: { $ref: "#/components/schemas/Component" },
              type: "array",
            },
            total: { type: "integer" },
          },
          required: ["components", "total"],
          type: "object",
        },
        Error: {
          description:
            "An error. `error` is a stable code, `message` says what went wrong and `hint` what to do next.",
          properties: {
            error: {
              enum: [
                "invalid_parameter",
                "method_not_allowed",
                "not_acceptable",
                "not_found",
              ],
              type: "string",
            },
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
        SearchHit: {
          properties: {
            api_url: {
              description: "The section, from getComponent.",
              format: "uri",
              type: "string",
            },
            component: { example: "knob", type: "string" },
            heading: { type: "string" },
            section: { example: "api-reference", type: "string" },
            snippet: { type: "string" },
          },
          required: ["component", "section", "heading", "snippet", "api_url"],
          type: "object",
        },
        SearchResults: {
          properties: {
            hint: {
              description: "What to try next, when nothing matched.",
              type: "string",
            },
            hits: {
              items: { $ref: "#/components/schemas/SearchHit" },
              type: "array",
            },
            query: { type: "string" },
            total: { type: "integer" },
          },
          required: ["hits", "query", "total"],
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
      description: "The REST API's docs, with examples.",
      url: API_DOCS,
    },
    info: {
      contact: {
        email: siteConfig.email,
        name: "Ouest Labs",
        url: `${url}/contact`,
      },
      description: `The public, read-only HTTP surface of ${siteConfig.name}. No key, no account.

The REST API, at ${API_BASE}, answers JSON: the components, their docs as markdown, a search of the docs and the catalog of ready-made blocks, the same answers as the MCP tools. Every error is JSON too, with a code, a message and a hint.

The other paths, served from the site's root: the shadcn registry, whose address for a file is \`/r/styles/{style}/{name}.json?v={deployment}\` (the shorter \`/r/{name}.json\` and \`/r/{style}/{name}.json\`, the one the shadcn CLI uses, redirect there with a 307, so follow redirects), the docs as markdown, llms.txt and the MCP server.

${VERSIONING}`,
      license: { identifier: "MIT", name: "MIT" },
      summary:
        "The audio/ui REST API, registry, docs and MCP server, for programs and agents.",
      title: `${siteConfig.name} API`,
      version: "1.0.0",
    },
    openapi: "3.1.0",
    paths: {
      "/": {
        get: {
          description:
            "The entry point: the version of the API and where every endpoint is.",
          operationId: "getApiRoot",
          responses: {
            "200": apiAnswer("The API's entry point.", "ApiRoot"),
            "405": { $ref: "#/components/responses/MethodNotAllowed" },
            "429": { $ref: "#/components/responses/TooManyRequests" },
          },
          summary: "Start here",
          tags: ["API"],
        },
      },
      "/.well-known/api-catalog": {
        get: {
          description:
            "The site's APIs as a linkset (RFC 9727): for each, its OpenAPI description, its docs and its status.",
          operationId: "getApiCatalog",
          responses: {
            "200": {
              content: {
                "application/linkset+json": {
                  schema: {
                    properties: {
                      linkset: { items: { type: "object" }, type: "array" },
                    },
                    required: ["linkset"],
                    type: "object",
                  },
                },
              },
              description:
                'The API catalog, with the profile parameter "https://www.rfc-editor.org/info/rfc9727".',
            },
          },
          summary: "List the site's APIs",
          tags: ["API"],
        },
        servers: SITE,
      },
      "/api": {
        get: {
          description:
            "The versions of the REST API and their status. Today there is one, v1.",
          operationId: "listApiVersions",
          responses: {
            "200": {
              content: json("ApiVersions"),
              description: "The versions.",
            },
            "405": { $ref: "#/components/responses/MethodNotAllowed" },
            "429": { $ref: "#/components/responses/TooManyRequests" },
          },
          summary: "List the API's versions",
          tags: ["API"],
        },
        servers: SITE,
      },
      "/catalog": {
        get: {
          description:
            "The catalog of ready-made blocks and demos (players, synth panels, mixers, piano rolls), 25 at a time. Leave q empty to list them all.",
          operationId: "searchCatalog",
          parameters: [
            {
              description: "Words such as synth, player or xypad.",
              in: "query",
              name: "q",
              required: false,
              schema: { type: "string" },
            },
            {
              description: "Items to skip: the next_offset of the page before.",
              in: "query",
              name: "offset",
              required: false,
              schema: { default: 0, minimum: 0, type: "integer" },
            },
          ],
          responses: {
            "200": apiAnswer("A page of the catalog.", "CatalogPage"),
            "400": { $ref: "#/components/responses/InvalidParameter" },
            "405": { $ref: "#/components/responses/MethodNotAllowed" },
            "429": { $ref: "#/components/responses/TooManyRequests" },
          },
          summary: "Search the catalog of blocks",
          tags: ["API"],
        },
      },
      "/components": {
        get: {
          description:
            "Every component, or those of one kind: elements (knob, fader, meter, piano), workstation (timeline, piano roll, mixer) or devices (compressor, reverb, synth).",
          operationId: "listComponents",
          parameters: [
            {
              description: "Only the components of this kind.",
              in: "query",
              name: "kind",
              required: false,
              schema: {
                enum: ["elements", "workstation", "devices"],
                type: "string",
              },
            },
          ],
          responses: {
            "200": apiAnswer("The components.", "ComponentList"),
            "400": { $ref: "#/components/responses/InvalidParameter" },
            "405": { $ref: "#/components/responses/MethodNotAllowed" },
            "429": { $ref: "#/components/responses/TooManyRequests" },
          },
          summary: "List the components",
          tags: ["API"],
        },
      },
      "/components/{name}": {
        get: {
          description:
            "One component and its docs as markdown: installation, usage, API reference and examples. A section returns only that part, which keeps the answer short; the sections are listed in every answer.",
          operationId: "getComponent",
          parameters: [
            {
              description: "The component's name, from listComponents.",
              example: "knob",
              in: "path",
              name: "name",
              required: true,
              schema: { type: "string" },
            },
            {
              description:
                "One section of the page, such as installation, usage or api-reference.",
              in: "query",
              name: "section",
              required: false,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": apiAnswer("The component and its docs.", "ComponentDocs"),
            "400": { $ref: "#/components/responses/InvalidParameter" },
            "404": {
              content: json("Error"),
              description:
                "No component of that name: the hint names the nearest ones.",
            },
            "405": { $ref: "#/components/responses/MethodNotAllowed" },
            "429": { $ref: "#/components/responses/TooManyRequests" },
          },
          summary: "Read a component's docs",
          tags: ["API"],
        },
      },
      "/llm": {
        get: {
          description:
            "The docs introduction as markdown: the two layers, how to install and where to go next.",
          operationId: "getDocsIntroduction",
          responses: { "200": markdown("The page, as markdown.") },
          summary: "Read the docs introduction",
          tags: ["Docs"],
        },
        servers: SITE,
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
          summary: "Read a component's docs as markdown",
          tags: ["Docs"],
        },
        servers: SITE,
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
        servers: SITE,
      },
      "/llm/{page}": {
        get: {
          description:
            "A guide as markdown, such as get-started, registry, primitives, styling, mcp, api or engine. llms.txt lists them all.",
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
        servers: SITE,
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
        servers: SITE,
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
        servers: SITE,
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
              content: json("JsonRpcResponse"),
              description: "The JSON-RPC response.",
            },
            "202": {
              description: "A notification, accepted. No body.",
            },
            "406": {
              content: json("JsonRpcResponse"),
              description:
                "The Accept header does not take both application/json and text/event-stream.",
            },
          },
          summary: "Call the MCP server",
          tags: ["Agents"],
        },
        servers: SITE,
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
        servers: SITE,
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
              content: json("RegistryIndex"),
              description: "The registry index.",
            },
            "307": redirect("/r/styles/{style}/registry.json?v={deployment}"),
            "404": registryNotFound,
          },
          summary: "List the registry's items",
          tags: ["Registry"],
        },
        servers: SITE,
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
              content: json("RegistryItem"),
              description: "The item.",
            },
            "307": redirect("/r/styles/{style}/{name}.json?v={deployment}"),
            "404": registryNotFound,
          },
          summary: "Get a registry item",
          tags: ["Registry"],
        },
        servers: SITE,
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
        servers: SITE,
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
        servers: SITE,
      },
      "/search": {
        get: {
          description:
            "Search the text of the component docs, such as log scale frequency knob or drag handle on a plot. Each hit names a component and a section: read it with getComponent.",
          operationId: "searchDocs",
          parameters: [
            {
              description: "Words about what to build or understand.",
              in: "query",
              name: "q",
              required: true,
              schema: { minLength: 2, type: "string" },
            },
            {
              description: "Hits to return.",
              in: "query",
              name: "limit",
              required: false,
              schema: { default: 8, maximum: 20, minimum: 1, type: "integer" },
            },
          ],
          responses: {
            "200": apiAnswer("The hits, best first.", "SearchResults"),
            "400": { $ref: "#/components/responses/InvalidParameter" },
            "405": { $ref: "#/components/responses/MethodNotAllowed" },
            "429": { $ref: "#/components/responses/TooManyRequests" },
          },
          summary: "Search the docs",
          tags: ["API"],
        },
      },
    },
    // Public: no operation asks for a key.
    security: [],
    servers: [
      { description: `The REST API, version ${API_VERSION}`, url: API_BASE },
    ],
    tags: [
      {
        description:
          "The REST API: the components, their docs and the catalog, as JSON.",
        name: "API",
      },
      {
        description: "The shadcn registry: components, blocks, hooks and libs.",
        name: "Registry",
      },
      { description: "The docs, as markdown.", name: "Docs" },
      { description: "The MCP server for AI agents.", name: "Agents" },
    ],
  };
}
