import { SparkleIcon } from "@audio-ui/icons/react";
import { ArrowRightIcon } from "@phosphor-icons/react/ssr";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const WORDS = ["Web", "React", "Vue", "Svelte"];
/** The reel's rows: the words, then the first again, so the last turn rolls on into it before the reel goes back to the top unseen. */
const ROWS = [
  ...WORDS.map((word) => ({ key: word, word })),
  { key: "again", word: WORDS[0] },
];
const HOLD_MS = 2500;
const ROLL_MS = 600;

/**
 * The hero's last word, rolling through where audio/ui runs: one strip of
 * words in a slot as wide as the longest, moving up a row at a time. The
 * words are generated content, so the heading reads as the sentence beside
 * it; with reduced motion it stays on the first.
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
        {ROWS.map(({ key, word }) => (
          <span
            className="before:content-[attr(data-word)]"
            data-word={word}
            key={key}
          />
        ))}
      </span>
    </span>
  );
}

/** The line above the product on the landing page: what it is, and where to start. */
export function HomeHero() {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 pt-4 pb-6 sm:px-6">
      <div className="flex min-w-0 flex-col">
        <h1 className="whitespace-nowrap font-medium font-site-heading text-2xl leading-tight sm:text-3xl">
          Audio UI for{" "}
          <span className="sr-only">the Web, React, Vue and Svelte</span>
          <HeroReel />
        </h1>
        <p className="text-balance text-site-muted-foreground text-sm">
          Knobs, faders, meters, waveforms, timelines and piano rolls, as custom
          elements for any framework, headless React primitives on npm, or React
          components you install with the shadcn CLI.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
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
