import type { FrameworkId } from "@/lib/docs/content/frameworks";

const AGENT_NOTE =
  "Add a note to AGENTS.md, creating it if needed: before using audio/ui, follow the audio-ui skill if it is installed, and read https://www.audio-ui.dev/llms.txt. A component's page is https://www.audio-ui.dev/docs/components/base/<name>, and every docs page is also served as markdown.";
const SKILLS_STEP =
  "If you support skills, run: npx skills@latest add ouestlabs/audio-ui";
const MCP_STEP =
  "If you support MCP servers, connect https://www.audio-ui.dev/mcp, so you can search the components and read their docs live.";
const BY_HAND =
  "If the CLI cannot run, do it by hand: open the item's JSON address, write each entry of files to its path under components/audio-ui/ with its content, and install the packages of its dependencies.";
const RELEASE_AGE =
  "If a release-age policy blocks an install, stop and ask me instead of changing it.";

const steps = (lines: readonly string[]) =>
  lines.map((line, index) => `${index + 1}. ${line}`).join("\n");

/** What a reader pastes into an agent to set audio/ui up in a project of their framework. */
export const QUICK_START_PROMPTS: Record<FrameworkId, string> = {
  react: `Set up audio/ui in this React project. It needs React 19 or newer and Tailwind CSS v4, with shadcn/ui set up (components.json).

${steps([
  `Components install with the shadcn CLI, and @audio-ui is in shadcn's registry directory, so there is nothing to configure. For example: npx shadcn@latest add @audio-ui/knob. The headless primitive alone is @audio-ui/knob-react. ${RELEASE_AGE}`,
  AGENT_NOTE,
  SKILLS_STEP,
  MCP_STEP,
])}`,
  svelte: `Set up audio/ui in this Svelte project. It needs Svelte 5. The shadcn CLI needs a components.json at the root, and the files land in src/lib/components: import them through the alias of src/lib ($lib, or #lib in the latest SvelteKit; outside SvelteKit, add the alias to the bundler's config): create what is missing. Tailwind CSS is not needed.

${steps([
  `Primitives install with the shadcn CLI, for example: npx shadcn@latest add https://www.audio-ui.dev/r/styles/base-nova/knob-svelte.json. The name of the item is <primitive>-svelte. ${RELEASE_AGE} ${BY_HAND}`,
  AGENT_NOTE,
  SKILLS_STEP,
  MCP_STEP,
])}`,
  vue: `Set up audio/ui in this Vue project. It needs Vue 3. The shadcn CLI needs a components.json at the root with the components alias, and the bundler needs that alias: create what is missing. Tailwind CSS is not needed.

${steps([
  `Primitives install with the shadcn CLI, for example: npx shadcn@latest add https://www.audio-ui.dev/r/styles/base-nova/knob-vue.json. The name of the item is <primitive>-vue. ${RELEASE_AGE} ${BY_HAND}`,
  AGENT_NOTE,
  SKILLS_STEP,
  MCP_STEP,
])}`,
  web: `Set up audio/ui in this project, with no framework: plain HTML and a module script. The shadcn CLI needs a components.json with the components alias, and no Tailwind CSS.

${steps([
  `Primitives install with the shadcn CLI, for example: npx shadcn@latest add https://www.audio-ui.dev/r/styles/base-nova/knob-web.json. The name of the item is <primitive>-web. Import the file once, and it registers the audio-ui-knob tags. ${RELEASE_AGE} ${BY_HAND}`,
  AGENT_NOTE,
  SKILLS_STEP,
  MCP_STEP,
])}`,
};

/** The first thing to ask an agent once it is set up. */
export const BUILD_PROMPT =
  "Build a filter cutoff control with audio/ui: a knob from 20 Hz to 20 kHz on a log scale, that shows its value in Hz and returns to 1 kHz on a double click. Use our existing styles.";

const TAG = /<QuickStart\s*\/>/g;

/** The `<QuickStart />` of a page as the prompts it shows, for the pages served as markdown. */
export function expandQuickStart(content: string) {
  const prompts = (Object.keys(QUICK_START_PROMPTS) as FrameworkId[])
    .map((id) => `**${id}**\n\n\`\`\`text\n${QUICK_START_PROMPTS[id]}\n\`\`\``)
    .join("\n\n");
  return content.replace(
    TAG,
    () =>
      `Copy the prompt of your framework into your agent.\n\n${prompts}\n\nThen ask your agent to build a component:\n\n\`\`\`text\n${BUILD_PROMPT}\n\`\`\``
  );
}

const CARD =
  /<LinkCard\s+href="([^"]+)"\s+title="([^"]+)">([^<]*)<\/LinkCard>/g;
const CARDS_TAG = /<\/?LinkCards>\n?/g;

/** The `<LinkCard>`s of a page as a list of links, for the pages served as markdown. */
export function expandLinkCards(content: string) {
  return content
    .replace(
      CARD,
      (_tag, href: string, title: string, text: string) =>
        `- [${title}](${href}): ${text}`
    )
    .replace(CARDS_TAG, "");
}
