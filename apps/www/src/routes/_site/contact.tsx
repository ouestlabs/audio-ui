import { createFileRoute } from "@tanstack/react-router";
import { TextPage } from "@/components/site/pages/text-page";
import { siteConfig } from "@/lib/config";
import { buildPageMetadata } from "@/lib/seo/seo";

const description =
  "How to reach the people behind audio/ui: questions, bug reports, security reports and everything else.";

export const Route = createFileRoute("/_site/contact")({
  component: ContactPage,
  head: () =>
    buildPageMetadata({
      description,
      path: "/contact",
      title: "Contact",
      titleSuffix: siteConfig.metadata.titleSuffixes.site,
    }),
});

function ContactPage() {
  const email = <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>;
  return (
    <TextPage lead={description} title="Contact">
      <p>
        audio/ui is made in the open by Ouest Labs, so most questions get the
        fastest answer on GitHub, where everyone who uses the library can see it
        and add to it.
      </p>
      <h2>Questions and help</h2>
      <p>
        If something does not work the way you expect, or you are not sure which
        component fits, open a question in the{" "}
        <a
          href={`${siteConfig.links.github}/discussions`}
          rel="noopener noreferrer"
        >
          GitHub discussions
        </a>
        . Say what you are building, what you tried and what happened.
      </p>
      <h2>Bugs and feature requests</h2>
      <p>
        Report a bug or ask for a feature in the{" "}
        <a
          href={`${siteConfig.links.github}/issues/new/choose`}
          rel="noopener noreferrer"
        >
          GitHub issues
        </a>
        . A bug report is easiest to fix with the component, the version of the
        package and the steps that reproduce it.
      </p>
      <h2>Security</h2>
      <p>
        Report a vulnerability privately by email to {email}, not in a public
        issue. Name the package or the page that is affected and how to
        reproduce it, so it can be fixed before it is made public.
      </p>
      <h2>Everything else</h2>
      <p>
        For anything else, such as a partnership, the press or a question about
        your data, write to {email}. Releases are announced on X by{" "}
        <a href={siteConfig.links.twitter} rel="noopener noreferrer">
          @ouestlabs
        </a>
        , and the maintainer is{" "}
        <a href={siteConfig.author.twitter} rel="noopener noreferrer">
          @luu_loua
        </a>
        .
      </p>
    </TextPage>
  );
}
