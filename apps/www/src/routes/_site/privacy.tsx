import { createFileRoute } from "@tanstack/react-router";
import { TextPage } from "@/components/site/pages/text-page";
import { siteConfig } from "@/lib/config";
import { buildPageMetadata } from "@/lib/seo/seo";

const description =
  "What audio-ui.dev records when a person or an agent uses it, and why. There are no accounts and no ads, and nothing is sold.";

export const Route = createFileRoute("/_site/privacy")({
  component: PrivacyPage,
  head: () =>
    buildPageMetadata({
      description,
      path: "/privacy",
      title: "Privacy",
      titleSuffix: siteConfig.metadata.titleSuffixes.site,
    }),
});

function PrivacyPage() {
  const email = <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>;
  return (
    <TextPage lead={description} title="Privacy">
      <p>Last updated on October 26, 2026.</p>
      <p>
        The site is run by Ouest Labs. Write to {email} about anything on this
        page.
      </p>
      <h2>Analytics in the browser</h2>
      <p>
        The site uses PostHog to learn which pages and components are used and
        to find bugs. Once a page has loaded, it records page views, clicks,
        errors and a few events of our own, such as copying an install command.
        It may also record sessions, meaning how the page changes and where the
        pointer moves, to reproduce interface bugs, with what is typed into
        fields masked.
      </p>
      <p>
        PostHog keeps an anonymous identifier in a cookie and in the local
        storage of this site, so that visits can be counted, and may use your IP
        address to estimate your country and city. The data goes through this
        site's own address to PostHog's servers in the United States.
      </p>
      <h2>Agents and programs</h2>
      <p>
        When the registry, the MCP server, llms.txt or a docs page in markdown
        is requested, the server records the address, the host and the
        User-Agent header, with no identifier for a person.
      </p>
      <p>
        When an agent calls the MCP server, PostHog records the tool it called
        and its arguments, the name and version of its client, the model it
        reports and the reason it gives for the call. Email addresses, phone
        numbers and IP addresses are removed from that reason. Do not put
        personal data in the arguments of a tool.
      </p>
      <h2>Stored in your browser</h2>
      <p>
        The theme, the layout and the settings of the design system customizer
        are kept in the local storage of your browser, so the site looks the
        same on your next visit. They stay there.
      </p>
      <h2>Hosting</h2>
      <p>
        Cloudflare hosts the site. It processes each request, including your IP
        address, to deliver the page and protect the site from abuse. The fonts
        and scripts are served from this site: there are no third-party fonts,
        no ads and no trackers other than the analytics above.
      </p>
      <h2>Your choices</h2>
      <p>
        Clearing the cookies and the local storage of this site removes the
        identifier. To ask what we hold about you, or to have it deleted, write
        to {email}. This page changes when what the site records changes, and
        the date above says when it last did.
      </p>
    </TextPage>
  );
}
