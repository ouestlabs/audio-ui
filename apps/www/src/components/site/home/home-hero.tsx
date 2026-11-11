"use client";

import { SparkleIcon } from "@audio-ui/icons/react";
import { ArrowRightIcon } from "@phosphor-icons/react/ssr";
import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { CopyButton } from "@/components/code/copy/copy-button";
import { Icons } from "@/components/site/icons";
import { Button } from "@/components/ui/button";
import { Knob } from "@/registry-audio/bases/base/audio/elements/knob";
import { Lcd } from "@/registry-audio/bases/base/audio/elements/lcd";
import { Led } from "@/registry-audio/bases/base/audio/elements/led";
import { RockerSwitch } from "@/registry-audio/bases/base/audio/elements/rocker-switch";

/** How to start: the command to run and the line to write. */
interface Start {
  command: string;
  line: string;
}

/**
 * Where audio/ui runs, each with its logo and how to start there, headless
 * and, for React alone, styled. The web's logo is JavaScript's, as on the
 * Elements page.
 */
const FRAMEWORKS: {
  headless: Start;
  logo: (typeof Icons)["vue"];
  name: string;
  styled?: Start;
}[] = [
  {
    headless: {
      command: "npm i @audio-ui/elements",
      line: 'import "@audio-ui/elements/knob";',
    },
    logo: Icons.javascript,
    name: "Web",
  },
  {
    headless: {
      command: "npm i @audio-ui/react",
      line: 'import { Knob } from "@audio-ui/react/knob";',
    },
    logo: Icons.reactColor,
    name: "React",
    styled: {
      command: "npx shadcn add @audio-ui/knob",
      line: 'import { Knob } from "@/components/audio-ui/knob";',
    },
  },
  {
    headless: {
      command: "npm i @audio-ui/elements",
      line: 'import type {} from "@audio-ui/elements/vue";',
    },
    logo: Icons.vue,
    name: "Vue",
  },
  {
    headless: {
      command: "npm i @audio-ui/elements",
      line: 'import type {} from "@audio-ui/elements/svelte";',
    },
    logo: Icons.svelte,
    name: "Svelte",
  },
];
const LAST = FRAMEWORKS.length - 1;
const MARKS = FRAMEWORKS.map((_, index) => index);
const HOLD_MS = 2500;
const ROLL_MS = 600;
const LABEL =
  "font-site-mono text-[10px] text-site-muted-foreground uppercase tracking-[0.1em]";

const nameOf = (index: number) => FRAMEWORKS[index]?.name ?? "";

/**
 * The framework the title names: a strip of the names, each after its logo,
 * in a slot as wide as the longest, rolled to the one selected. The names
 * are generated content, so the heading reads as the sentence beside it.
 */
function FrameworkReel({ index }: { index: number }) {
  return (
    <span aria-hidden="true" className="inline-flex h-lh overflow-hidden">
      <span
        className="flex flex-col transition-transform ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
        style={{
          transform: `translateY(calc(${index} * -1lh))`,
          transitionDuration: `${ROLL_MS}ms`,
        }}
      >
        {FRAMEWORKS.map(({ logo: Logo, name }) => (
          <span className="flex items-center gap-[0.3em]" key={name}>
            <Logo className="size-[0.8em] shrink-0" />
            <span
              className="before:content-[attr(data-word)]"
              data-word={name}
            />
          </span>
        ))}
      </span>
    </span>
  );
}

/**
 * The top of the home: the title names a framework, and a panel of audio/ui's
 * own hardware picks it. The knob selects the framework, an LED shows which,
 * the rocker picks the styled components or the headless packages (React
 * alone has both), and the screens show how to start there. The knob turns
 * itself until the reader reaches for the panel; with reduced motion it rests
 * on the web.
 */
export function HomeHero() {
  const [index, setIndex] = useState(0);
  const [styled, setStyled] = useState(true);
  const [taken, setTaken] = useState(false);

  useEffect(() => {
    if (
      taken ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const timer = window.setInterval(
      () => setIndex((current) => (current === LAST ? 0 : current + 1)),
      HOLD_MS
    );
    return () => window.clearInterval(timer);
  }, [taken]);

  const take = useCallback(() => setTaken(true), []);
  const select = useCallback((value: number) => setIndex(value), []);
  const tip = useCallback((on: boolean) => setStyled(on), []);

  const framework = FRAMEWORKS[index] ?? FRAMEWORKS[0];
  const start =
    styled && framework.styled ? framework.styled : framework.headless;

  return (
    <div className="grid shrink-0 gap-6 px-4 pt-6 pb-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
      <div className="flex min-w-0 flex-col gap-4">
        <h1 className="whitespace-nowrap font-medium font-site-heading text-2xl leading-tight sm:text-3xl">
          Audio UI for{" "}
          <span className="sr-only">the Web, React, Vue and Svelte</span>
          <FrameworkReel index={index} />
        </h1>
        <p className="max-w-2xl text-balance text-site-muted-foreground text-sm">
          Knobs, faders, meters, waveforms, timelines and piano rolls, as custom
          elements for any framework, headless React primitives on npm, or React
          components you install with the shadcn CLI.
        </p>
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

      {/* The reader takes the panel as soon as they reach for it, before anything moves. */}
      <section
        aria-label="How to start"
        className="flex w-full flex-col gap-4 rounded-xl border bg-card p-4 text-card-foreground shadow-xs lg:w-[27rem]"
        onFocusCapture={take}
        onPointerDownCapture={take}
      >
        <div className="flex items-center gap-5">
          <Knob
            aria-label="Framework"
            dragMode="vertical"
            formatValue={nameOf}
            marks={MARKS}
            max={LAST}
            min={0}
            onValueChange={select}
            size="sm"
            step={1}
            value={index}
            valueLabel="hidden"
          />
          <ul className="grid flex-1 grid-cols-2 gap-x-4 gap-y-2">
            {FRAMEWORKS.map((each, at) => (
              <li className="flex items-center gap-2" key={each.name}>
                <Led label={each.name} on={at === index} size="sm" />
                <span className={LABEL}>{each.name}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-col items-center gap-1">
            <span className={LABEL}>Styled</span>
            <RockerSwitch
              aria-label="Styled components"
              checked={styled && Boolean(framework.styled)}
              disabled={!framework.styled}
              onCheckedChange={tip}
              size="sm"
            />
            <span className={LABEL}>Headless</span>
          </div>
        </div>
        <div className="flex items-stretch gap-2">
          <Lcd className="min-w-0 flex-1" label="Install">
            {start.command}
          </Lcd>
          <CopyButton
            // Beside the screen, not in a code block's corner.
            className="static h-auto self-stretch"
            event="copy_command"
            value={start.command}
            variant="outline"
          />
        </div>
        <Lcd className="w-full" label="Import" size="sm">
          {start.line}
        </Lcd>
      </section>
    </div>
  );
}
