---
title: "Wiring: AI SDK, Anthropic or OpenAI SDKs, MCP"
impact: MEDIUM
impactDescription: validated arguments instead of parsed prose, run where the state lives
tags: ai, tools, sdk, mcp
---

## Wiring: AI SDK, Anthropic or OpenAI SDKs, MCP

Asking the model to answer in JSON and parsing its text breaks on the first stray sentence, and nothing checks the values. Tool calls carry arguments the schema validates before anything touches state.

The state of a component lives in the browser, but the model is called from a server route (the API key can't ship to the page). So the server declares the tools with their schemas and **no** `execute`, and the browser runs each call on its state and sends the result back.

**Incorrect (prose parsed as JSON):**

```ts
const { text } = await generateText({ model, prompt: `${userText}\nAnswer with JSON notes.` });
setState((prev) => ({ ...prev, notes: JSON.parse(text) })); // throws, or writes anything
```

**Incorrect (an `execute` that needs browser state, on the server):**

```ts
tool({
  description: t.description,
  inputSchema: t.schema,
  execute: async (args) => setState((prev) => t.apply(prev, args)), // no setState in a route
});
```

**Correct (Vercel AI SDK: schemas on the server, the call runs in the browser):**

```ts
// app/api/chat/route.ts
import { convertToModelMessages, streamText, tool, type UIMessage } from "ai";
import type { ZodType } from "zod";
import { pianoRollTools } from "@/lib/piano-roll-ai"; // createPianoRollTools(your roll's config)
import type { PianoRollState } from "@/lib/piano-roll-tools";

// No `execute`. The schemas are widened to ZodType: `tool()` can't infer one
// input type from six different schemas.
const tools = Object.fromEntries(
  Object.entries(pianoRollTools).map(([name, t]) => [
    name,
    tool({ description: t.description, inputSchema: t.schema as ZodType }),
  ])
);

export async function POST(request: Request) {
  const { messages, state }: { messages: UIMessage[]; state: PianoRollState } =
    await request.json();

  const result = streamText({
    messages: await convertToModelMessages(messages),
    model: "anthropic/claude-sonnet-4.5", // a model id on the AI Gateway, or a provider's model
    system: `You edit a piano roll through tools. Current state: ${JSON.stringify(state)}`,
    tools,
  });
  return result.toUIMessageStreamResponse();
}
```

```tsx
// components/use-roll-chat.ts
"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai";

export function useRollChat(
  applyTool: (name: string, input: unknown) => string, // from the rule ai-tools-edit-state
  getState: () => PianoRollState
) {
  const chat = useChat({
    onToolCall: ({ toolCall }) => {
      const { toolCallId, toolName } = toolCall;
      try {
        // Not awaited: waiting on the output inside onToolCall can deadlock the chat.
        chat.addToolOutput({ output: applyTool(toolName, toolCall.input), tool: toolName, toolCallId });
      } catch (cause) {
        chat.addToolOutput({
          errorText: cause instanceof Error ? cause.message : "The tool call failed.",
          state: "output-error",
          tool: toolName,
          toolCallId,
        });
      }
    },
    // Once every call has its output, the model gets them back and answers.
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ body, messages }) => ({
        body: { ...body, messages, state: getState() }, // the roll as it is now
      }),
    }),
  });
  return chat;
}
```

Written against AI SDK 6 and 7 (`inputSchema`, `addToolOutput`).

**Correct (Anthropic or OpenAI SDKs, MCP servers):** send `z.toJSONSchema(t.schema)` (zod 4) as each tool's input schema. On a tool call, wherever the state lives:

```ts
const parsed = t.schema.safeParse(input);
if (!parsed.success) {
  return { isError: true, content: parsed.error.message }; // the model retries
}
const next = t.apply(current, parsed.data);
return { content: "applied" };
```

Prefer few, coarse tools (`setNotes` replaces the whole roll) over many tiny ones: models do better writing a whole phrase at once.
