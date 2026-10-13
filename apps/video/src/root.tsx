import "./styles.css";
import "./fonts.ts";
import { Composition } from "remotion";
import { Showcases } from "./compositions/showcases.tsx";
import {
  SPOTLIGHT_DEFAULTS,
  SPOTLIGHT_SECONDS,
  Spotlight,
} from "./compositions/spotlight.tsx";
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
        component={Showcases}
        durationInFrames={6 * FPS}
        fps={FPS}
        height={1300}
        id="Showcases"
        width={2200}
      />
    </>
  );
}
