import { createFileRoute, Link } from "@tanstack/react-router";
import { TextPage } from "@/components/site/pages/text-page";
import { siteConfig } from "@/lib/config";
import { buildPageMetadata } from "@/lib/seo/seo";

const description =
  "audio/ui is an open-source library of accessible audio controls for React, made by Ouest Labs and released under the MIT license.";

export const Route = createFileRoute("/_site/about")({
  component: AboutPage,
  head: () =>
    buildPageMetadata({
      description,
      path: "/about",
      title: "About",
      titleSuffix: siteConfig.metadata.titleSuffixes.site,
    }),
});

function AboutPage() {
  return (
    <TextPage lead={description} title="About audio/ui">
      <h2>What it is</h2>
      <p>
        audio/ui is a set of accessible, composable controls for audio
        interfaces: knobs, faders, XY pads, envelopes, meters, waveforms,
        timelines, sequencers, drum pads, piano keyboards and piano rolls, and
        the panels of effects and instruments built from them. Each control
        handles the pointer, the wheel and the keyboard, and is announced
        correctly by a screen reader, so an app does not have to implement those
        details again.
      </p>
      <p>It ships in layers that share the same behavior:</p>
      <ul>
        <li>
          <code>@audio-ui/react</code>, headless React primitives on npm:
          behavior and accessibility, no styles.
        </li>
        <li>
          The <code>@audio-ui</code> registry, styled components and blocks you
          install with the shadcn CLI and own as your own code.
        </li>
        <li>
          <code>@audio-ui/core</code>, the same controllers without React, for
          Vue, Svelte, Solid, Angular, web components or the plain DOM.
        </li>
      </ul>
      <h2>Who makes it</h2>
      <p>
        audio/ui is made by{" "}
        <a href="https://github.com/ouestlabs" rel="noopener noreferrer">
          Ouest Labs
        </a>
        , based in West Africa, and has been developed in the open since 2024.
        It was created and is maintained by{" "}
        <a href={siteConfig.author.url} rel="noopener noreferrer">
          {siteConfig.author.name}
        </a>
        , a UX/UI developer.
      </p>
      <h2>License and source</h2>
      <p>
        Everything is free and open source under the MIT license, for personal
        and commercial use. The code, the issues and the roadmap are on{" "}
        <a href={siteConfig.links.github} rel="noopener noreferrer">
          GitHub
        </a>
        , and the packages are on{" "}
        <a href={siteConfig.links.npm} rel="noopener noreferrer">
          npm
        </a>
        . Contributions are welcome: the contribution guide in the repository
        explains how to add a component to the registry.
      </p>
      <h2>Built for agents</h2>
      <p>
        AI coding agents use audio/ui as much as people do. Every docs page is
        also served as markdown, the{" "}
        <Link params={{ _splat: "mcp" }} to="/docs/$">
          MCP server
        </Link>{" "}
        lets an agent search the components and read their docs, and the{" "}
        <Link params={{ _splat: "agents" }} to="/docs/$">
          agent skills
        </Link>{" "}
        teach it which layer to pick and how to install it.
      </p>
      <h2>Get in touch</h2>
      <p>
        Questions, bug reports and security reports each have their place on the{" "}
        <Link to="/contact">contact page</Link>. What the site records is on the{" "}
        <Link to="/privacy">privacy page</Link>.
      </p>
    </TextPage>
  );
}
