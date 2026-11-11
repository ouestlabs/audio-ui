"use client";

import { SparkleIcon } from "@audio-ui/icons/react";
import { ArrowRightIcon } from "@phosphor-icons/react/ssr";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Icons } from "@/components/site/icons";
import { Button } from "@/components/ui/button";

/** Where audio/ui runs, each with its logo: the web's is JavaScript's, as on the Elements page. */
const WORDS = [
  { logo: Icons.javascript, word: "Web" },
  { logo: Icons.reactColor, word: "React" },
  { logo: Icons.vue, word: "Vue" },
  { logo: Icons.svelte, word: "Svelte" },
];
/** The reel's rows: the words, then the first again, so the last turn rolls on into it before the reel goes back to the top unseen. */
const ROWS = [
  ...WORDS.map((each) => ({ ...each, key: each.word })),
  { ...WORDS[0], key: "again" },
];
const HOLD_MS = 2500;
const ROLL_MS = 600;

/**
 * The hero's last word, rolling through where audio/ui runs: one strip of
 * words, each after its logo, in a slot as wide as the longest, moving up a
 * row at a time. The words are generated content, so the heading reads as
 * the sentence beside it; with reduced motion it stays on the first.
 */
function HeroReel() {
  const [row, setRow] = useState(0);
  const [rolling, setRolling] = useState(true);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    let current = 0;
    let wrap: number | undefined;
    const timer = window.setInterval(() => {
      current += 1;
      setRolling(true);
      setRow(current);
      // On the first word again: back to the top, without a roll, once there.
      if (current === WORDS.length) {
        wrap = window.setTimeout(() => {
          current = 0;
          setRolling(false);
          setRow(0);
        }, ROLL_MS);
      }
    }, HOLD_MS);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(wrap);
    };
  }, []);

  return (
    <span aria-hidden="true" className="inline-flex h-lh overflow-hidden">
      <span
        className="flex flex-col ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
        style={{
          transform: `translateY(calc(${row} * -1lh))`,
          transitionDuration: rolling ? `${ROLL_MS}ms` : "0ms",
          transitionProperty: "transform",
        }}
      >
        {ROWS.map(({ key, logo: Logo, word }) => (
          <span className="flex items-center gap-[0.3em]" key={key}>
            <Logo className="size-[0.8em] shrink-0" />
            <span
              className="before:content-[attr(data-word)]"
              data-word={word}
            />
          </span>
        ))}
      </span>
    </span>
  );
}

/**
 * The top of the home, as any page of the site opens: the title, one line,
 * and the ways in. What audio/ui is shows in what follows, not in a staged
 * section.
 */
export function HomeHero() {
  return (
    <div className="flex shrink-0 flex-col gap-2 px-4 pt-6 pb-8 sm:px-6 lg:pt-8">
      <h1 className="scroll-m-20 whitespace-nowrap font-semibold font-site-heading text-4xl tracking-tight sm:text-3xl xl:text-4xl">
        Audio UI for{" "}
        <span className="sr-only">the Web, React, Vue and Svelte</span>
        <HeroReel />
      </h1>
      <p className="max-w-2xl text-[1.05rem] text-site-muted-foreground sm:text-base">
        Knobs, faders, meters, waveforms, timelines and piano rolls, as custom
        elements for any framework, headless React primitives on npm, or React
        components you install with the shadcn CLI.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          nativeButton={false}
          render={
            <Link params={{ _splat: "get-started" }} to="/docs/$">
              Get started <ArrowRightIcon aria-hidden weight="bold" />
            </Link>
          }
        />
        <Button
          nativeButton={false}
          render={<Link to="/components">Browse components</Link>}
          variant="outline"
        />
        <Button
          nativeButton={false}
          render={
            <Link params={{ _splat: "agents" }} to="/docs/$">
              <SparkleIcon aria-hidden className="size-4" />
              For agents
            </Link>
          }
          variant="ghost"
        />
      </div>
    </div>
  );
}
