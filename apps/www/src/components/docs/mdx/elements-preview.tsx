"use client";

import { useEffect, useRef, useState } from "react";
import { PreviewPanel } from "@/components/preview/frame/preview-frame";
import { Frame } from "@/components/site/layout/frame";

/**
 * A knob and a fader as custom elements, with the classes the registry's
 * own Knob and Fader take: the same CSS styles both. They are rendered once
 * the elements are registered, and a line under them says each event they
 * fire.
 */
export function ElementsPreview() {
  const [registered, setRegistered] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const eventRef = useRef<HTMLOutputElement>(null);

  useEffect(() => {
    // On the client only: the elements register when their module runs.
    import("@audio-ui/elements").then(() => setRegistered(true));
  }, []);

  useEffect(() => {
    const panel = panelRef.current;
    const output = eventRef.current;
    if (!(registered && panel && output)) {
      return;
    }
    const text = document.createTextNode("Turn the knob or move the fader");
    output.replaceChildren(text);
    // One text node's data, written on each event: no render per move of a drag.
    const show = (event: Event) => {
      const { detail, type } = event as CustomEvent<{
        reason: string;
        value: number;
      }>;
      const control = (event.target as Element).tagName.toLowerCase();
      text.data = `${control}: ${type} ${detail.value} (${detail.reason})`;
    };
    panel.addEventListener("input", show);
    panel.addEventListener("change", show);
    return () => {
      panel.removeEventListener("input", show);
      panel.removeEventListener("change", show);
    };
  }, [registered]);

  return (
    <Frame className="mt-4 mb-12" data-slot="elements-preview">
      <PreviewPanel className="min-h-72 gap-4">
        {registered ? (
          <div
            className="flex items-center justify-center gap-16"
            ref={panelRef}
          >
            <audio-ui-knob
              className="cn-knob cn-knob-size-default group/knob relative mb-8 inline-flex outline-none"
              max="100"
              min="0"
              value="40"
            >
              <audio-ui-knob-control
                className="cn-knob-control transform-[translateZ(0)] relative isolate flex size-full cursor-grab touch-none select-none outline-none [clip-path:circle(50%_at_50%_50%)] active:cursor-grabbing"
                data-slot="knob-control"
              >
                <div className="cn-knob-body cn-knob-body-size-default absolute z-0" />
                <audio-ui-knob-track className="cn-knob-arc pointer-events-none absolute inset-0 z-1 block size-full opacity-22" />
                <audio-ui-knob-indicator className="cn-knob-arc pointer-events-none absolute inset-0 z-1 block size-full" />
                <audio-ui-knob-thumb
                  aria-label="Cutoff"
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
            <audio-ui-fader className="group/fader relative h-40" value="-6">
              <audio-ui-fader-control className="relative flex h-full w-auto touch-none select-none flex-col items-center">
                <audio-ui-fader-track className="cn-fader-track cn-fader-track-size-default relative grow cursor-pointer select-none overflow-hidden">
                  <audio-ui-fader-indicator className="cn-fader-range absolute w-full select-none" />
                </audio-ui-fader-track>
                <audio-ui-fader-thumb
                  aria-label="Volume"
                  className="cn-fader-thumb cn-fader-thumb-size-default absolute z-10 block shrink-0 cursor-grab select-none outline-none active:cursor-grabbing"
                />
              </audio-ui-fader-control>
            </audio-ui-fader>
          </div>
        ) : null}
        <output
          aria-live="off"
          className="font-mono text-muted-foreground text-xs tabular-nums"
          ref={eventRef}
        />
      </PreviewPanel>
    </Frame>
  );
}
