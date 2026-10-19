import { createFileRoute } from "@tanstack/react-router";
import retroSynthCss from "../retro-synth/retro-synth.css?url";
import { RetroSynth } from "../retro-synth/retro-synth.tsx";

export const Route = createFileRoute("/retro-synth")({
  component: RetroSynth,
  head: () => ({
    links: [{ href: retroSynthCss, rel: "stylesheet" }],
    meta: [{ title: "Orion-1" }],
  }),
});
