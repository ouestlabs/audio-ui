"use client";

import type { FaderElement, FaderInputEvent } from "@audio-ui/elements/fader";
import type { KnobElement, KnobInputEvent } from "@audio-ui/elements/knob";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { highlightedElements } from "@/components/code/block/highlighted-code";
import { CopyButton } from "@/components/code/copy/copy-button";
import { PreviewPanel } from "@/components/preview/frame/preview-frame";
import { Icons } from "@/components/site/icons";
import { Frame } from "@/components/site/layout/frame";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Fader } from "@/registry-audio/bases/base/audio/elements/fader";
import { Knob } from "@/registry-audio/bases/base/audio/elements/knob";

/** The value as both read it: a whole percent. */
const FORMAT = {
  maximumFractionDigits: 0,
  style: "unit",
  unit: "percent",
} as const satisfies Intl.NumberFormatOptions;
const FORMAT_ATTRIBUTE = JSON.stringify(FORMAT);
const MIN_DB = -60;
const MAX_DB = 6;

/** The knob of what you see, in each framework. */
const CODE = [
  {
    code: `import { Knob } from "@/components/audio-ui/knob";

const [mix, setMix] = useState(40);

<Knob aria-label="Mix" onValueChange={setMix} value={mix} />;`,
    icon: Icons.reactColor,
    language: "tsx",
    name: "React",
  },
  {
    code: `<script setup lang="ts">
import "@audio-ui/elements/knob";
import { ref } from "vue";

const mix = ref(40);
</script>

<template>
  <audio-ui-knob v-model="mix">
    <audio-ui-knob-control>
      <audio-ui-knob-thumb aria-label="Mix" />
    </audio-ui-knob-control>
  </audio-ui-knob>
</template>`,
    icon: Icons.vue,
    language: "vue",
    name: "Vue",
  },
  {
    code: `<script lang="ts">
  import "@audio-ui/elements/knob";

  let mix = $state(40);
</script>

<audio-ui-knob value={mix} oninput={(event) => (mix = event.detail.value)}>
  <audio-ui-knob-control>
    <audio-ui-knob-thumb aria-label="Mix"></audio-ui-knob-thumb>
  </audio-ui-knob-control>
</audio-ui-knob>`,
    icon: Icons.svelte,
    language: "svelte",
    name: "Svelte",
  },
  {
    code: `<audio-ui-knob value="40">
  <audio-ui-knob-control>
    <audio-ui-knob-thumb aria-label="Mix"></audio-ui-knob-thumb>
  </audio-ui-knob-control>
</audio-ui-knob>

<script type="module">
  import "@audio-ui/elements/knob";

  const knob = document.querySelector("audio-ui-knob");
  knob.addEventListener("input", (event) => setMix(event.detail.value));
</script>`,
    icon: Icons.javascript,
    language: "html",
    name: "HTML",
  },
];

/** A framework's side: its name over the controls it draws. */
function Side({
  children,
  icon: Icon,
  name,
  source,
}: {
  children: ReactNode;
  icon: (typeof Icons)["vue"];
  name: string;
  source: string;
}) {
  return (
    <Frame>
      <div className="flex items-center gap-2 px-3 py-2 text-sm">
        <Icon className="size-4" />
        <span className="font-medium">{name}</span>
        <code className="ml-auto font-site-mono text-site-muted-foreground text-xs">
          {source}
        </code>
      </div>
      <PreviewPanel>
        <div className="flex h-56 items-center justify-center gap-12">
          {children}
        </div>
      </PreviewPanel>
    </Frame>
  );
}

/**
 * The same knob and fader as custom elements, drawn in the registry's style
 * as the Elements pages draw them, on the values given: each is set as a
 * property once its element is defined, and reports its `input`.
 */
function ElementControls({
  level,
  mix,
  onLevel,
  onMix,
}: {
  level: number;
  mix: number;
  onLevel: (value: number) => void;
  onMix: (value: number) => void;
}) {
  const knob = useRef<KnobElement>(null);
  const fader = useRef<FaderElement>(null);
  const [defined, setDefined] = useState(false);

  // The elements register when their modules run, on the client only.
  useEffect(() => {
    let live = true;
    Promise.all([
      import("@audio-ui/elements/knob"),
      import("@audio-ui/elements/fader"),
    ]).then(() => {
      if (live) {
        setDefined(true);
      }
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (defined && knob.current && knob.current.value !== mix) {
      knob.current.value = mix;
    }
  }, [defined, mix]);

  useEffect(() => {
    if (defined && fader.current && fader.current.value !== level) {
      fader.current.value = level;
    }
  }, [defined, level]);

  useEffect(() => {
    const knobElement = knob.current;
    const faderElement = fader.current;
    if (!(defined && knobElement && faderElement)) {
      return;
    }
    const turn = (event: KnobInputEvent) => onMix(event.detail.value);
    const slide = (event: FaderInputEvent) => onLevel(event.detail.value);
    // One signal lets both listeners go: the elements type addEventListener, not its removal.
    const listening = new AbortController();
    knobElement.addEventListener("input", turn, { signal: listening.signal });
    faderElement.addEventListener("input", slide, { signal: listening.signal });
    return () => listening.abort();
  }, [defined, onLevel, onMix]);

  return (
    <>
      <audio-ui-knob
        className="cn-knob cn-knob-size-default group/knob relative mb-8 inline-flex outline-none"
        format={FORMAT_ATTRIBUTE}
        max="100"
        min="0"
        ref={knob}
        value={String(mix)}
      >
        <audio-ui-knob-control
          className="cn-knob-control transform-[translateZ(0)] relative isolate flex size-full cursor-grab touch-none select-none outline-none [clip-path:circle(50%_at_50%_50%)] active:cursor-grabbing"
          data-slot="knob-control"
        >
          <div className="cn-knob-body cn-knob-body-size-default absolute z-0" />
          <audio-ui-knob-track className="cn-knob-arc pointer-events-none absolute inset-0 z-1 block size-full opacity-22" />
          <audio-ui-knob-indicator className="cn-knob-arc pointer-events-none absolute inset-0 z-1 block size-full" />
          <audio-ui-knob-thumb
            aria-label="Mix, custom element"
            className="pointer-events-none absolute inset-0 z-2"
          >
            <svg
              aria-hidden="true"
              className="cn-knob-indicator block size-full"
              viewBox="0 0 48 48"
            >
              <line
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth={2.75}
                x1={24}
                x2={24}
                y1={11.53}
                y2={18.84}
              />
            </svg>
          </audio-ui-knob-thumb>
        </audio-ui-knob-control>
        <audio-ui-knob-value className="cn-knob-value pointer-events-none absolute top-full left-1/2 z-10 mt-1 -translate-x-1/2 whitespace-nowrap" />
      </audio-ui-knob>
      <audio-ui-fader
        className="group/fader relative h-40"
        max={String(MAX_DB)}
        min={String(MIN_DB)}
        ref={fader}
        value={String(level)}
      >
        <audio-ui-fader-control className="relative flex h-full w-auto touch-none select-none flex-col items-center">
          <audio-ui-fader-track className="cn-fader-track cn-fader-track-size-default relative grow cursor-pointer select-none overflow-hidden">
            <audio-ui-fader-indicator className="cn-fader-range absolute w-full select-none" />
          </audio-ui-fader-track>
          <audio-ui-fader-thumb
            aria-label="Level, custom element"
            className="cn-fader-thumb cn-fader-thumb-size-default before:-inset-2 absolute z-10 block shrink-0 cursor-grab select-none outline-none before:absolute before:content-[''] active:cursor-grabbing"
          >
            {/* The registry thumb's three lines, so the two faders look alike. */}
            <div
              className="cn-fader-thumb-inner-size-default flex h-full w-full flex-col items-center justify-center gap-0.5"
              data-orientation="vertical"
            >
              <div
                className="cn-fader-thumb-mark cn-fader-thumb-mark-size-default"
                data-orientation="vertical"
              />
              <div
                className="cn-fader-thumb-mark cn-fader-thumb-mark-size-default"
                data-orientation="vertical"
              />
              <div
                className="cn-fader-thumb-mark cn-fader-thumb-mark-size-default"
                data-orientation="vertical"
              />
            </div>
          </audio-ui-fader-thumb>
        </audio-ui-fader-control>
      </audio-ui-fader>
    </>
  );
}

/** A snippet as the page's fences draw it, with its copy button. */
function Snippet({ code, language }: { code: string; language: string }) {
  const { elements } = highlightedElements(code, language, false);
  return (
    <figure data-not-typeset="" data-rehype-pretty-code-figure="">
      <pre
        className={`scrollbar-y min-w-0 overflow-x-auto px-4 py-3.5 outline-none th-code th-code--${language}`}
        data-language={language}
      >
        <CopyButton value={code} />
        <code>{elements}</code>
      </pre>
    </figure>
  );
}

/**
 * audio/ui's own live piece: one knob and one fader, drawn by the React
 * components and by the custom elements, on one value. Turn either, the
 * other follows; the tabs give the knob's code in each framework.
 */
export function HomeSameControl() {
  const [mix, setMix] = useState(40);
  const [level, setLevel] = useState(-6);
  const onMix = useCallback((value: number) => setMix(value), []);
  const onLevel = useCallback((value: number) => setLevel(value), []);

  return (
    <section aria-labelledby="home-same" className="px-4 pb-12 sm:px-6">
      <h2
        className="text-balance font-medium font-site-heading text-xl leading-tight sm:text-2xl"
        id="home-same"
      >
        One control, every framework
      </h2>
      <p className="mt-3 max-w-2xl text-pretty text-site-muted-foreground text-sm">
        The same knob and fader, drawn by the React components and by the custom
        elements, on one value: turn either, the other follows.
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Side icon={Icons.reactColor} name="React" source="@audio-ui/react">
          <Knob
            aria-label="Mix, React"
            format={FORMAT}
            max={100}
            min={0}
            onValueChange={onMix}
            value={mix}
            valueLabel="always"
          />
          <div className="h-40">
            <Fader
              aria-label="Level, React"
              max={MAX_DB}
              min={MIN_DB}
              onValueChange={onLevel}
              value={level}
              valueLabel="hidden"
            />
          </div>
        </Side>
        <Side
          icon={Icons.javascript}
          name="Custom elements"
          source="@audio-ui/elements"
        >
          <ElementControls
            level={level}
            mix={mix}
            onLevel={onLevel}
            onMix={onMix}
          />
        </Side>
      </div>
      <Tabs className="mt-4" defaultValue="React">
        <TabsList aria-label="Framework">
          {CODE.map(({ icon: Icon, name }) => (
            <TabsTrigger key={name} value={name}>
              <Icon className="size-3.5" />
              {name}
            </TabsTrigger>
          ))}
        </TabsList>
        {CODE.map(({ code, language, name }) => (
          <TabsContent className="mt-2" key={name} value={name}>
            <Snippet code={code} language={language} />
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}
