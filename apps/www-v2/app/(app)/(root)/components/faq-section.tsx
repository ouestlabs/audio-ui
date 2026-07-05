import Link from "next/link";
import type { ReactNode } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

const FAQ_INLINE_LINK = /\[([^\]]+)\]\(([^)]+)\)/g;

/** Renders `[Label](/path)` as internal `<Link>` (same styling as homepage hero links). */
export function renderFaqAnswerWithInlineLinks(text: string): ReactNode {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  const re = new RegExp(FAQ_INLINE_LINK.source, "g");
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const label = match[1];
    const href = match[2];
    parts.push(
      <Link
        className="font-semibold text-site-primary underline underline-offset-4"
        href={href}
        key={`faq-a-${key++}`}
      >
        {label}
      </Link>
    );
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length > 0 ? <>{parts}</> : text;
}

export interface FAQSectionItem {
  id?: string;
  question: ReactNode;
  answer: ReactNode;
}

export const defaultAudioFaqItems: FAQSectionItem[] = [
  {
    id: "free-open-source",
    question: "Are audio/ui components free and open source?",
    answer:
      "Yes. audio/ui is free and MIT-licensed. Every component is open source, copy-and-own, and built for the shadcn/ui ecosystem. Use it in personal, commercial, and enterprise projects without attribution requirements.",
  },
  {
    id: "primitives-vs-registry",
    question:
      "What's the difference between @audio-ui/react and the registry components?",
    answer:
      "@audio-ui/react is the headless primitives package — unstyled, accessible building blocks like Fader, Knob, Transport, XYPad, and ChannelStrip, published to npm. The registry components you install with `npx shadcn@latest add @audio/{name}` are styled wrappers around those primitives, built on top of shadcn/ui, that you copy into your own project and own the source for. Most projects only need the registry components; reach for the primitives package directly if you're building your own visual layer.",
  },
  {
    id: "react-next",
    question: "Can I use audio/ui components in React and Next.js projects?",
    answer:
      "Yes. audio/ui components are built for modern React and integrate naturally into Next.js App Router projects or any React-based framework. Everything follows the same client/server component boundaries shadcn/ui uses.",
  },
  {
    id: "tailwind-shadcn-support",
    question: "Do audio/ui components work with Tailwind CSS v4 and shadcn/ui?",
    answer:
      "Yes. audio/ui components are built directly on top of shadcn/ui primitives and styled with Tailwind CSS v4 utility classes, and are fully compatible with the shadcn design system.",
  },
  {
    id: "shadcn-create-compatibility",
    question:
      "Are audio/ui components compatible with Shadcn Create style options?",
    answer:
      "Yes. audio/ui components are compiled against all Shadcn Create style configurations. Every style option you configure in the customizer — base color, color scale, border radius, and font family — propagates to the previews and to the source code you copy.",
  },
  {
    id: "best-starting-points",
    question:
      "Which audio/ui components are the best starting point for a new project?",
    answer:
      "For most audio interfaces the highest-leverage starting point is the [Audio Player](/docs/components/base/player) — it bundles playback, queue, and track list controls in one component. For building custom controls, [Knob](/docs/components/base/knob), [Fader](/docs/components/base/fader), and [XY Pad](/docs/components/base/xypad) cover the most common parameter controls.",
  },
  {
    id: "base-radix",
    question: "Does audio/ui support Radix UI as well as Base UI?",
    answer:
      "Not yet. audio/ui components currently ship for Base UI only. A Radix UI variant is on the [roadmap](/docs/roadmap).",
  },
];

interface FAQSectionProps {
  badge?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  items?: FAQSectionItem[];
  className?: string;
}

export function FAQSection({
  badge = "FAQ",
  title = "Frequently asked questions about audio/ui components",
  description = "Answers about free open-source shadcn/ui components, React and Tailwind CSS usage, and how to use audio/ui in real product UI.",
  items = defaultAudioFaqItems,
  className,
}: FAQSectionProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section
      className={cn(
        "container-wrapper mb-20 py-12 [contain-intrinsic-size:1px_1100px] [content-visibility:auto]",
        className
      )}
    >
      <div className="container space-y-10">
        <h2 className="mx-auto text-balance text-center font-semibold text-3xl sm:text-4xl">
          Frequently Asked Questions
        </h2>

        <div className="site-rounded-xl mx-auto mt-8 max-w-3xl border border-site-border bg-site-background px-6 py-2">
          <Accordion className="w-full" collapsible type="single">
            {items.map((item, index) => {
              const value = item.id ?? `faq-${index}`;

              return (
                <AccordionItem key={value} value={value}>
                  <AccordionTrigger className="flex items-center gap-2 text-left text-sm">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-pretty text-site-foreground/90 text-sm leading-7">
                    {typeof item.answer === "string"
                      ? renderFaqAnswerWithInlineLinks(item.answer)
                      : item.answer}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
