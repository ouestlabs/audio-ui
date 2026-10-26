import { describe, expect, test } from "bun:test";
import "./fixtures/agent-docs";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { act, render } from "@testing-library/react";

const { getDocsSpaces } = await import("@/lib/docs/content/spaces");
const { HomeGuide } = await import("@/components/site/home/home-guide");
const { buildFaqJsonLd } = await import("@/lib/seo/seo");

const HEADING = /^H([1-6])$/;

/** The guide in a router of its own, as the home renders it: its links need one. */
async function renderGuide() {
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ["/"] }),
    routeTree: createRootRoute({
      component: () => <HomeGuide spaces={getDocsSpaces()} />,
    }),
  });
  await act(() => router.load());
  return render(<RouterProvider router={router} />);
}

describe("getDocsSpaces", () => {
  test("lists each space's pages, with their title, description and address", () => {
    expect(getDocsSpaces()).toEqual([
      {
        sections: [
          {
            pages: [
              {
                description: "What makes the sound.",
                title: "Overview",
                url: "/docs/engine",
              },
            ],
            title: undefined,
          },
          {
            pages: [
              {
                description: "A clock that schedules notes ahead.",
                title: "Clock and time",
                url: "/docs/engine/clock-and-time",
              },
            ],
            title: "Time",
          },
        ],
        title: "Audio engine",
      },
    ]);
  });
});

describe("HomeGuide", () => {
  test("links every page of every space, with what it does", async () => {
    const { container } = await renderGuide();
    const link = container.querySelector(
      'a[href="/docs/engine/clock-and-time"]'
    );
    expect(link?.textContent).toBe("Clock and time");
    expect(container.textContent).toContain(
      "A clock that schedules notes ahead."
    );
  });

  test("keeps its headings in order, from h2 down, with no level skipped", async () => {
    const { container } = await renderGuide();
    const levels = [
      ...container.querySelectorAll("h1, h2, h3, h4, h5, h6"),
    ].map((heading) => Number(HEADING.exec(heading.tagName)?.[1]));
    expect(levels[0]).toBe(2);
    for (const [index, level] of levels.entries()) {
      expect(level - (levels[index - 1] ?? 1)).toBeLessThanOrEqual(1);
    }
  });

  test("says what audio/ui is in words a crawler reads, without running scripts", async () => {
    const { container } = await renderGuide();
    const text = container.cloneNode(true) as HTMLElement;
    for (const script of text.querySelectorAll("script")) {
      script.remove();
    }
    expect(text.textContent?.replace(/\s+/g, " ").length).toBeGreaterThan(2000);
  });

  test("answers its questions in a FAQPage, word for word what it shows", async () => {
    const { container } = await renderGuide();
    const script = container.querySelector(
      'script[type="application/ld+json"]'
    );
    const faq = JSON.parse(script?.textContent ?? "{}");
    expect(faq["@type"]).toBe("FAQPage");
    const shown = [...container.querySelectorAll("#home-faq ~ div h3")].map(
      (question) => question.textContent
    );
    expect(faq.mainEntity.map((q: { name: string }) => q.name)).toEqual(shown);
    for (const question of faq.mainEntity) {
      expect(container.textContent).toContain(question.acceptedAnswer.text);
    }
  });
});

describe("buildFaqJsonLd", () => {
  test("is a schema.org FAQPage of questions and accepted answers", () => {
    expect(
      buildFaqJsonLd([{ answer: "Yes, MIT.", question: "Is it free?" }])
    ).toEqual({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          acceptedAnswer: { "@type": "Answer", text: "Yes, MIT." },
          name: "Is it free?",
        },
      ],
    });
  });
});
