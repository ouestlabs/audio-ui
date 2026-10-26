import { Link } from "@tanstack/react-router";
import { CopyButton } from "@/components/code/copy/copy-button";
import { JsonLd } from "@/components/site/json-ld";
import { GroupIcon } from "@/components/site/navigation/group-icon";
import type { getDocsSpaces } from "@/lib/docs/content/spaces";
import { buildFaqJsonLd, type FaqItem } from "@/lib/seo/seo";

const INSTALL = [
  {
    command: "npx shadcn@latest add @audio-ui/knob",
    label: "Styled components, with shadcn/ui and Tailwind CSS v4",
  },
  {
    command: "npm install @audio-ui/react",
    label: "Headless primitives, for your own design system",
  },
];

const AGENTS = [
  {
    description:
      "Lets an agent search the components, read their docs and the catalog. No account.",
    title: "MCP server",
    url: "/docs/mcp",
  },
  {
    description:
      "Teach your agent which layer to pick, how to install and the mistakes to avoid.",
    title: "Agent skills",
    url: "/docs/agents",
  },
  {
    description: "The same answers as JSON: versioned, with no key.",
    title: "REST API",
    url: "/docs/api",
  },
  {
    description: "A map of every docs page, each one also served as markdown.",
    title: "llms.txt",
    url: "/llms.txt",
  },
];

const FAQ: FaqItem[] = [
  {
    answer:
      "An open-source library of accessible audio components for React: knobs, faders, meters, waveforms, timelines, step sequencers, piano rolls and more, as headless primitives on npm or as styled shadcn/ui components you own.",
    question: "What is audio/ui?",
  },
  {
    answer:
      "Yes. It is open source under the MIT license, for personal and commercial projects.",
    question: "Is audio/ui free?",
  },
  {
    answer:
      "No. With shadcn/ui and Tailwind CSS v4, install styled components from the registry. Without them, use the headless primitives of @audio-ui/react and style them your way.",
    question: "Do I need shadcn/ui?",
  },
  {
    answer:
      "The components are the interface: they take values and report changes, so they work with any engine, from the Web Audio API to an AudioWorklet or WebAssembly. The registry also has hooks and devices that make the sound with the Web Audio API.",
    question: "Does audio/ui play sound?",
  },
  {
    answer:
      "Yes. The controls use native inputs where it matters, carry labels, work entirely with the keyboard and are announced by screen readers.",
    question: "Is it accessible?",
  },
  {
    answer:
      "Yes. @audio-ui/core holds the same controllers without React, for Vue, Svelte, Solid, Angular, web components and the plain DOM.",
    question: "Can I use it outside React?",
  },
  {
    // No MCP endpoint address on the home: a scanner that finds one takes the
    // whole site for an MCP server. Its address is on the MCP page.
    answer:
      "Yes. Connect the MCP server, install the agent skills with npx skills add ouestlabs/audio-ui, or start from llms.txt and the REST API.",
    question: "Can an AI agent build with it?",
  },
];

const H2 =
  "text-balance font-medium font-site-heading text-xl leading-tight sm:text-2xl";
const LEAD = "max-w-2xl text-pretty text-site-muted-foreground text-sm";

/**
 * What the home says under its demo, in its HTML: what audio/ui is, how to
 * install it, every component with what it does, and answers to the usual
 * questions. Search engines and agents read the page without running it.
 */
export function HomeGuide({
  spaces,
}: {
  spaces: ReturnType<typeof getDocsSpaces>;
}) {
  return (
    <div className="flex flex-col gap-16 border-t px-4 py-12 font-site-sans sm:px-6 lg:py-16">
      <JsonLd data={buildFaqJsonLd(FAQ)} />
      <section
        aria-labelledby="home-about"
        className="grid gap-8 lg:grid-cols-2"
      >
        <div className="flex flex-col gap-3">
          <h2 className={H2} id="home-about">
            Audio controls for React, accessible and yours
          </h2>
          <p className={LEAD}>
            audio/ui is an open-source component library for audio interfaces in
            React: knobs, faders, XY pads, envelopes, level meters, waveforms,
            spectrum analyzers, tuners, timelines, step sequencers, drum pads,
            piano keyboards and piano rolls, and the panels of effects and
            instruments built from them. Every control works with a pointer and
            the keyboard, and is announced correctly by screen readers.
          </p>
          <p className={LEAD}>
            Pick the layer that fits your project. The <code>@audio-ui</code>{" "}
            registry gives styled components and ready blocks that the shadcn
            CLI copies into your code, for you to own. The{" "}
            <code>@audio-ui/react</code> package on npm gives headless
            primitives: the behavior and the accessibility, no styles.{" "}
            <code>@audio-ui/core</code> brings the same controllers to Vue,
            Svelte, Solid, Angular, web components and the plain DOM.
          </p>
        </div>
        {/* min-w-0: a grid cell would otherwise widen to the commands, which never wrap. */}
        <ul className="flex min-w-0 flex-col gap-4 self-center">
          {INSTALL.map((step) => (
            <li className="flex flex-col gap-1.5" key={step.command}>
              <span className="text-site-muted-foreground text-xs">
                {step.label}
              </span>
              <div className="flex items-center gap-2 rounded-lg border bg-site-muted/40 py-1 pr-1 pl-3">
                <code className="min-w-0 flex-1 truncate font-mono text-sm">
                  {step.command}
                </code>
                <CopyButton
                  // In the row, not in a code block's corner.
                  className="static bg-transparent"
                  event="copy_command"
                  value={step.command}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="home-components">
        <h2 className={H2} id="home-components">
          Every component, by what you build
        </h2>
        <p className={`${LEAD} mt-3`}>
          Controls and displays for any audio interface, the surfaces of a DAW,
          the effects and instruments you plug in, and the hooks that make the
          sound. Each page has a live preview, the install command, the API and
          the source.
        </p>
        <div className="mt-8 grid gap-x-8 gap-y-10 sm:grid-cols-2 xl:grid-cols-4">
          {spaces.map((space) => (
            <div key={space.title}>
              <h3 className="flex items-center gap-2 font-medium text-sm">
                <GroupIcon current={false} title={space.title} />
                {space.title}
              </h3>
              {space.sections.map((section) => (
                <div className="mt-4" key={section.title ?? space.title}>
                  {section.title ? (
                    <h4 className="text-site-muted-foreground text-xs">
                      {section.title}
                    </h4>
                  ) : null}
                  <ul className="mt-2 flex flex-col gap-2.5">
                    {section.pages.map((page) => (
                      <li key={page.url}>
                        <Link
                          className="font-medium text-sm hover:underline"
                          preload={false}
                          to={page.url}
                        >
                          {page.title}
                        </Link>
                        <p className="text-pretty text-site-muted-foreground text-xs leading-relaxed">
                          {page.description}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="home-agents"
        className="grid gap-8 lg:grid-cols-2"
      >
        <div className="flex flex-col gap-3">
          <h2 className={H2} id="home-agents">
            Built for AI agents
          </h2>
          <p className={LEAD}>
            Coding agents use audio/ui as much as people do. Every docs page is
            also served as markdown, and every component can be found, read and
            installed without a browser.
          </p>
        </div>
        <ul className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {AGENTS.map((resource) => (
            <li key={resource.url}>
              <Link
                className="font-medium text-sm hover:underline"
                preload={false}
                reloadDocument={resource.url === "/llms.txt"}
                to={resource.url}
              >
                {resource.title}
              </Link>
              <p className="text-pretty text-site-muted-foreground text-xs leading-relaxed">
                {resource.description}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="home-faq">
        <h2 className={H2} id="home-faq">
          Questions
        </h2>
        <div className="mt-6 grid gap-x-8 gap-y-6 md:grid-cols-2">
          {FAQ.map((item) => (
            <div key={item.question}>
              <h3 className="font-medium text-sm">{item.question}</h3>
              <p className="mt-1 text-pretty text-site-muted-foreground text-sm">
                {item.answer}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
