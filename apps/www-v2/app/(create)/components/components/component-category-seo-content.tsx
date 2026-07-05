"use client";

import Link from "next/link";
import type * as React from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import type {
  ComponentCategorySeo,
  RelatedComponentsBlock,
} from "@/lib/registry";
import { isCanonicalComponentDoc } from "@/lib/seo";
import { cn } from "@/lib/utils";

function SeoInlineLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  const cls = cn(
    "font-medium text-site-primary underline underline-offset-4",
    className
  );
  if (href.startsWith("http://") || href.startsWith("https://")) {
    return (
      <a className={cls} href={href} rel="noopener noreferrer" target="_blank">
        {children}
      </a>
    );
  }
  return (
    <Link className={cls} href={href}>
      {children}
    </Link>
  );
}

function SeoInlineBadge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Badge
      className={cn(
        "bg-site-background px-1.5 py-0.5 text-site-foreground/90 text-xs",
        className
      )}
      variant="outline"
    >
      {children}
    </Badge>
  );
}

function hrefForCategorySlug(slug: string) {
  return isCanonicalComponentDoc(slug)
    ? `/docs/components/base/${slug}`
    : `/components/${slug}`;
}

function isInternalAppPath(href: string) {
  return (
    href.startsWith("/components/") ||
    href.startsWith("/docs/") ||
    (href.startsWith("/") && !href.startsWith("//"))
  );
}

/** Popular items (root): `title` is `[Component](/components/...)` then `: description`. */
function isFeatureItemLinkColonTitle(title: string) {
  return /^\[[^\]]+\]\([^)]+\)/.test(title.trimStart());
}

function renderInternalMarkdownLink(
  label: string,
  href: string,
  key: string
): React.ReactNode {
  return (
    <SeoInlineLink href={href} key={key}>
      {label}
    </SeoInlineLink>
  );
}

function renderBacktickContent(content: string, key: string): React.ReactNode {
  const trimmed = content.trim();
  if (trimmed.startsWith("pkg:")) {
    const pkg = trimmed.slice(4).trim();
    if (!pkg) {
      return <SeoInlineBadge key={key}>{content}</SeoInlineBadge>;
    }
    return <SeoInlineBadge key={key}>{pkg}</SeoInlineBadge>;
  }
  return <SeoInlineBadge key={key}>{trimmed || content}</SeoInlineBadge>;
}

/**
 * Inline SEO mini-markdown:
 * - `[label](url)` → internal or external link (same text-link style as category cards)
 * - `` `…` `` → `SeoInlineBadge` (same style for all chips)
 * - `**…**` and `*…*` → strong
 * - `{{count}}` / `[[count]]` stay literal until `applySeoCountPlaceholder`
 * - Legacy: `[[pkg:…]]`, `[[slug|Label]]` (same link style as `[Label](/components/slug)`)
 */
export function renderSeoLinkedText(
  text: string,
  keyPrefix: string
): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let pos = 0;
  let k = 0;

  const pushText = (s: string) => {
    if (s) parts.push(s);
  };

  while (pos < text.length) {
    const rest = text.slice(pos);

    if (rest.startsWith("{{count}}")) {
      pushText("{{count}}");
      pos += 9;
      continue;
    }
    if (rest.startsWith("[[count]]")) {
      pushText("[[count]]");
      pos += 9;
      continue;
    }

    const pkgLegacy = /^\[\[pkg:([^\]]+)\]\]/.exec(rest);
    if (pkgLegacy) {
      const name = pkgLegacy[1];
      parts.push(
        <SeoInlineBadge key={`${keyPrefix}-${k++}`}>{name}</SeoInlineBadge>
      );
      pos += pkgLegacy[0].length;
      continue;
    }

    const linkLegacy = /^\[\[([a-z0-9-]+)\|([^\]]+)\]\]/.exec(rest);
    if (linkLegacy) {
      const slug = linkLegacy[1];
      const label = linkLegacy[2];
      parts.push(
        renderInternalMarkdownLink(
          label,
          hrefForCategorySlug(slug),
          `${keyPrefix}-${k++}`
        )
      );
      pos += linkLegacy[0].length;
      continue;
    }

    if (rest[0] === "[" && rest[1] !== "[") {
      const md = /^\[([^\]]*)\]\(([^)]+)\)/.exec(rest);
      if (md) {
        const label = md[1];
        const url = md[2];
        if (url.startsWith("http://") || url.startsWith("https://")) {
          parts.push(
            <SeoInlineLink href={url} key={`${keyPrefix}-${k++}`}>
              {label || url}
            </SeoInlineLink>
          );
        } else if (isInternalAppPath(url)) {
          parts.push(
            renderInternalMarkdownLink(label, url, `${keyPrefix}-${k++}`)
          );
        } else {
          parts.push(
            <SeoInlineLink href={url} key={`${keyPrefix}-${k++}`}>
              {label || url}
            </SeoInlineLink>
          );
        }
        pos += md[0].length;
        continue;
      }
    }

    if (rest[0] === "`") {
      const end = rest.indexOf("`", 1);
      if (end > 0) {
        const inner = rest.slice(1, end);
        parts.push(renderBacktickContent(inner, `${keyPrefix}-${k++}`));
        pos += end + 1;
        continue;
      }
    }

    const strongDouble = /^\*\*([^*\n]+)\*\*/.exec(rest);
    if (strongDouble) {
      parts.push(
        <strong
          className="font-semibold text-foreground"
          key={`${keyPrefix}-${k++}`}
        >
          {strongDouble[1]}
        </strong>
      );
      pos += strongDouble[0].length;
      continue;
    }

    const strong = /^\*([^*\n]+)\*/.exec(rest);
    if (strong) {
      parts.push(
        <strong
          className="font-semibold text-foreground"
          key={`${keyPrefix}-${k++}`}
        >
          {strong[1]}
        </strong>
      );
      pos += strong[0].length;
      continue;
    }

    pushText(rest[0]);
    pos += 1;
  }

  return parts.length ? parts : [text];
}

/**
 * Category page hero (`seo.intro`): same inline mini-markdown as SEO body copy
 * (`**…**`, `[label](url)`, `` `pkg:…` ``, `{{count}}`, etc.).
 */
export function ComponentCategoryHeroIntro({ intro }: { intro: string }) {
  return (
    <p className="mt-4 block w-full max-w-none text-base text-site-muted-foreground leading-7">
      {renderSeoLinkedText(intro, "cat-hero-intro")}
    </p>
  );
}

/** Unified section title style (matches category SEO guide headings). */
export const SEO_BLOCK_TITLE_CLASS =
  "text-foreground text-xl font-semibold tracking-tight text-balance sm:text-2xl";

export function ComponentCategoryRelatedComponents({
  block,
}: {
  block: RelatedComponentsBlock;
}) {
  if (block.integrationBody?.length) {
    return (
      <section
        aria-labelledby="seo-related-components-heading"
        className="w-full space-y-6"
      >
        <h2
          className={SEO_BLOCK_TITLE_CLASS}
          id="seo-related-components-heading"
        >
          {block.title}
        </h2>

        <div className="w-full space-y-4 text-pretty text-[15px] text-site-muted-foreground leading-7 sm:text-base">
          {block.integrationBody.map((paragraph, paragraphIndex) => (
            <p key={paragraphIndex}>
              {renderSeoLinkedText(paragraph, `int${paragraphIndex}`)}
            </p>
          ))}
        </div>
      </section>
    );
  }

  if (block.links?.length) {
    return (
      <section
        aria-labelledby="seo-related-components-heading"
        className="w-full space-y-6"
      >
        <h2
          className={SEO_BLOCK_TITLE_CLASS}
          id="seo-related-components-heading"
        >
          {block.title}
        </h2>

        <ul className="grid gap-2 text-site-muted-foreground text-sm leading-7 sm:grid-cols-2 sm:text-base">
          {block.links.map((link) => (
            <li key={link.slug}>
              <SeoInlineLink href={`/components/${link.slug}`}>
                {link.label}
              </SeoInlineLink>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return null;
}

/**
 * Popular Components cards: split long descriptions after "Covers …" / "Supports …" into a lead + bullet list.
 */
function extractComponentListLeadAndBullets(description: string): {
  lead: string;
  bullets: string[];
} {
  const text = description.trim();
  const splitCovers = text.split(/\.\s*Covers\s+/i);
  const splitSupports = text.split(/\.\s*Supports\s+/i);

  let lead: string;
  let rest: string;

  if (splitCovers.length >= 2) {
    lead = splitCovers[0].trim();
    if (!lead.endsWith(".")) lead += ".";
    rest = splitCovers.slice(1).join(". Covers ");
  } else if (splitSupports.length >= 2) {
    lead = splitSupports[0].trim();
    if (!lead.endsWith(".")) lead += ".";
    rest = splitSupports.slice(1).join(". Supports ");
  } else {
    const dot = text.indexOf(". ");
    if (dot > 0) {
      lead = text.slice(0, dot + 1).trim();
      rest = text.slice(dot + 2).trim();
    } else {
      lead = text;
      rest = "";
    }
  }

  const bullets = rest
    ? rest
        .split(/,\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 2)
        .slice(0, 12)
    : [];

  return { lead, bullets };
}

interface ComponentCategorySeoContentProps {
  seo: ComponentCategorySeo;
}

export function ComponentCategorySeoContent({
  seo,
}: ComponentCategorySeoContentProps) {
  if (!(seo.content || seo.relatedComponents)) {
    return null;
  }

  const content = seo.content;

  return (
    <section
      aria-labelledby={
        content
          ? "component-category-guide-title"
          : "seo-related-components-heading"
      }
      className="bg-site-muted/15"
    >
      <div className="w-full px-6 py-10 sm:px-8 sm:py-14 xl:px-10">
        <div className="w-full space-y-12">
          {content ? (
            <header className="w-full space-y-4">
              <h2
                className={SEO_BLOCK_TITLE_CLASS}
                id="component-category-guide-title"
              >
                {content.title}
              </h2>
              <div className="w-full space-y-3">
                {content.summary.map((paragraph, i) => (
                  <p
                    className="w-full text-pretty text-site-muted-foreground text-sm leading-7 sm:text-base"
                    key={i}
                  >
                    {renderSeoLinkedText(paragraph, `sum-${i}`)}
                  </p>
                ))}
              </div>
            </header>
          ) : null}

          {content?.sections?.length ? (
            <div className="w-full space-y-12">
              {content.sections.map((section, si) => (
                <section className="w-full space-y-4" key={section.title}>
                  <h3 className={SEO_BLOCK_TITLE_CLASS}>{section.title}</h3>

                  {section.intro ? (
                    <p className="w-full text-pretty text-site-muted-foreground text-sm leading-7 sm:text-base">
                      {renderSeoLinkedText(section.intro, `sec-${si}-intro`)}
                    </p>
                  ) : null}

                  {section.componentList?.length ? (
                    <ul className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
                      {section.componentList.map((item) => {
                        const { lead, bullets } =
                          extractComponentListLeadAndBullets(item.description);
                        return (
                          <li
                            className="site-rounded-lg border border-site-border/80 bg-site-background p-4"
                            key={item.slug}
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <SeoInlineLink
                                className="text-base"
                                href={item.href}
                              >
                                {item.title}
                              </SeoInlineLink>
                              {item.badge ? (
                                <SeoInlineBadge>{item.badge}</SeoInlineBadge>
                              ) : null}
                            </div>
                            {bullets.length > 0 ? (
                              <>
                                <p className="mt-2 text-pretty text-site-muted-foreground text-sm leading-6">
                                  {renderSeoLinkedText(
                                    lead,
                                    `comp-${item.slug}-lead`
                                  )}
                                </p>
                                <ul className="mt-2 list-disc space-y-1.5 pl-5 text-site-muted-foreground text-sm leading-6 sm:list-outside">
                                  {bullets.map((b, bi) => (
                                    <li className="text-pretty" key={bi}>
                                      {renderSeoLinkedText(
                                        b,
                                        `comp-${item.slug}-b${bi}`
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </>
                            ) : (
                              <p className="mt-2 text-pretty text-site-muted-foreground text-sm leading-6">
                                {renderSeoLinkedText(
                                  item.description,
                                  `comp-${item.slug}`
                                )}
                              </p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}

                  {section.paragraphs?.map((paragraph, pi) => (
                    <p
                      className="w-full text-pretty text-site-muted-foreground text-sm leading-7 sm:text-base"
                      key={pi}
                    >
                      {renderSeoLinkedText(paragraph, `sec-${si}-p${pi}`)}
                    </p>
                  ))}

                  {section.featureItems?.length ? (
                    <ul className="w-full list-disc space-y-2 pl-6 text-site-muted-foreground text-sm leading-7 sm:list-outside sm:pl-7 sm:text-base">
                      {section.featureItems.map((item, fi) => {
                        const keyT = `sec-${si}-feat-${fi}-t`;
                        const keyD = `sec-${si}-feat-${fi}-d`;
                        if (isFeatureItemLinkColonTitle(item.title)) {
                          return (
                            <li
                              className="text-pretty"
                              key={`sec-${si}-feat-${fi}`}
                            >
                              {renderSeoLinkedText(item.title, keyT)}
                              <span aria-hidden="true">: </span>
                              {renderSeoLinkedText(item.description, keyD)}
                            </li>
                          );
                        }
                        return (
                          <li
                            className="text-pretty"
                            key={`sec-${si}-feat-${fi}`}
                          >
                            <span className="font-medium text-foreground">
                              {item.title}
                            </span>{" "}
                            {renderSeoLinkedText(item.description, keyD)}
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}

                  {section.bullets?.length ? (
                    <ul className="w-full list-disc space-y-2 pl-6 text-site-muted-foreground text-sm leading-7 sm:list-outside sm:pl-7 sm:text-base">
                      {section.bullets.map((bullet, bidx) => (
                        <li className="text-pretty" key={bullet}>
                          {renderSeoLinkedText(
                            bullet,
                            `sec-${si}-bull-${bidx}`
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ))}
            </div>
          ) : null}

          {seo.relatedComponents ? (
            <ComponentCategoryRelatedComponents block={seo.relatedComponents} />
          ) : null}

          {content?.faqs?.length ? (
            <section
              aria-labelledby="seo-faq-heading"
              className="w-full space-y-6"
            >
              <h2 className={SEO_BLOCK_TITLE_CLASS} id="seo-faq-heading">
                Frequently Asked Questions
              </h2>

              <Accordion className="w-full" collapsible type="single">
                {content.faqs.map((faq, index) => (
                  <AccordionItem
                    className="border-site-border/80"
                    key={faq.question}
                    value={`faq-${index}`}
                  >
                    <AccordionTrigger className="py-3 text-left font-medium text-foreground text-sm leading-snug hover:no-underline sm:text-base [&[data-state=open]>svg]:text-site-primary">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-pretty text-site-muted-foreground text-sm leading-7 sm:text-base">
                      {renderSeoLinkedText(faq.answer, `faq-${index}`)}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>
          ) : null}
        </div>
      </div>
    </section>
  );
}
