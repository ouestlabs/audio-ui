import { createFileRoute } from "@tanstack/react-router";
import retroSynthCss from "../components/devices/retro-synth.css?url";
import { RetroSynth } from "../components/devices/retro-synth.tsx";

export const Route = createFileRoute("/retro-synth")({
  component: RetroSynth,
  head: () => ({
    links: [{ href: retroSynthCss, rel: "stylesheet" }],
    meta: [{ title: "Orion-1" }],
  }),
});
