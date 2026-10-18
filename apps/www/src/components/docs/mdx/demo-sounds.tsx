"use client";

import { PauseIcon, PlayIcon } from "@phosphor-icons/react/ssr";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import {
  DEMO_SOURCES,
  type DemoSourceName,
  renderDemoSource,
} from "@/registry-audio/bases/base/lib/demo-sound";
import { webAudio } from "@/registry-audio/bases/base/lib/web-audio";

const NAMES = Object.keys(DEMO_SOURCES) as DemoSourceName[];

/**
 * The sounds the previews play, each with what to listen for and a button to
 * hear it on a loop, one at a time, through the same master bus as a preview.
 */
export function DemoSounds() {
  const [playing, setPlaying] = useState<DemoSourceName | null>(null);
  const master = useMasterBus(0.7);

  useEffect(() => {
    const ctx = webAudio.getContext();
    if (!(playing && ctx && master)) {
      return;
    }
    ctx.resume();
    let cancelled = false;
    let stop = () => undefined;
    renderDemoSource(playing, ctx.sampleRate).then((buffer) => {
      if (cancelled) {
        return;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(master);
      source.start();
      stop = () => {
        source.stop();
        source.disconnect();
      };
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, [master, playing]);

  const toggle = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    const name = event.currentTarget.dataset.name as DemoSourceName;
    setPlaying((current) => (current === name ? null : name));
  }, []);

  return (
    <ul
      className="my-6 divide-y rounded-lg border border-site-border"
      data-not-typeset=""
    >
      {NAMES.map((name) => {
        const { about, title } = DEMO_SOURCES[name];
        const on = playing === name;
        const Icon = on ? PauseIcon : PlayIcon;
        return (
          <li className="flex items-center gap-3 p-3" key={name}>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm">
                {title}{" "}
                <code className="font-normal text-site-muted-foreground text-xs">
                  {name}
                </code>
              </p>
              <p className="text-site-muted-foreground text-sm">{about}</p>
            </div>
            <Button
              aria-label={`${on ? "Stop" : "Play"} ${title}`}
              aria-pressed={on}
              className="shrink-0 aria-pressed:bg-site-accent"
              data-name={name}
              onClick={toggle}
              size="icon"
              variant="outline"
            >
              <Icon aria-hidden="true" />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
