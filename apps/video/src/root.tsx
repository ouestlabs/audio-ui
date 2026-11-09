import "./styles.css";
import "./fonts.ts";
import { Composition } from "remotion";
import { REGISTRY_SECONDS, Registry } from "./compositions/registry.tsx";
import { Showcases } from "./compositions/showcases.tsx";
import {
  SPOTLIGHT_DEFAULTS,
  SPOTLIGHT_SECONDS,
  Spotlight,
} from "./compositions/spotlight.tsx";
import { STARS_SECONDS, Stars } from "./compositions/stars.tsx";
import { TEASER_SECONDS, Teaser } from "./compositions/teaser.tsx";

const FPS = 60;
const LANDSCAPE = { height: 1080, width: 1920 };

export function Root() {
  return (
    <>
      <Composition
        component={Teaser}
        durationInFrames={Math.round(TEASER_SECONDS * FPS)}
        fps={FPS}
        id="Teaser"
        {...LANDSCAPE}
      />
      <Composition
        component={Spotlight}
        defaultProps={SPOTLIGHT_DEFAULTS}
        durationInFrames={Math.round(SPOTLIGHT_SECONDS * FPS)}
        fps={FPS}
        id="Spotlight"
        {...LANDSCAPE}
      />
      <Composition
        component={Registry}
        defaultProps={{ theme: "light" as const }}
        durationInFrames={Math.round(REGISTRY_SECONDS * FPS)}
        fps={FPS}
        id="Registry"
        {...LANDSCAPE}
      />
      <Composition
        component={Stars}
        defaultProps={{ stars: 200, theme: "light" as const }}
        durationInFrames={Math.round(STARS_SECONDS * FPS)}
        fps={FPS}
        id="Stars"
        {...LANDSCAPE}
      />
      <Composition
        component={Showcases}
        durationInFrames={6 * FPS}
        fps={FPS}
        height={1500}
        id="Showcases"
        width={2200}
      />
    </>
  );
}
