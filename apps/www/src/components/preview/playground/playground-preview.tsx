import { type ComponentType, useEffect, useRef } from "react";
import { HighlightedCode } from "@/components/code/block/highlighted-code";
import { useSkin } from "@/hooks/use-skin";
import { useSkinAxes } from "@/hooks/use-skin-axes";
import { chosenAxes } from "@/lib/design-system/look";
import {
  codeOf,
  type Framework,
  lookFor,
  type PlaygroundLook,
  type PlaygroundName,
  propsOf,
  reactFrame,
  skinFrame,
  webMarkup,
} from "@/lib/docs/playground/playgrounds";
import { usePlayground, useShownPlayground } from "@/lib/docs/playground/store";
import {
  mountInShadow,
  type ShadowSkin,
} from "@/lib/registry/core/mount-styled";
import { Fader } from "@/registry/bases/shared/audio-ui/elements/fader";
import { Knob } from "@/registry/bases/shared/audio-ui/elements/knob";
import { Meter } from "@/registry/bases/shared/audio-ui/elements/meter";
import { HardwareFader } from "@/registry/bases/shared/audio-ui/skins/hardware/fader";
import { HardwareKnob } from "@/registry/bases/shared/audio-ui/skins/hardware/knob";
import { HardwareVuMeter } from "@/registry/bases/shared/audio-ui/skins/hardware/vu-meter";

type Props = Record<string, unknown>;

const DIGITAL: Record<PlaygroundName, ComponentType<Props>> = {
  fader: Fader as ComponentType<Props>,
  knob: Knob as ComponentType<Props>,
  meter: Meter as ComponentType<Props>,
};

const HARDWARE: Record<PlaygroundName, ComponentType<Props>> = {
  fader: HardwareFader as ComponentType<Props>,
  knob: HardwareKnob as ComponentType<Props>,
  meter: HardwareVuMeter as ComponentType<Props>,
};

/** The skin the reader picked in the Look and the axes they set over it: none for Digital. */
function useLook(): PlaygroundLook | undefined {
  const [skin] = useSkin();
  const { values } = useSkinAxes();
  return skin === "digital" ? undefined : { axes: chosenAxes(values), skin };
}

/** The element in React, in the skin the reader picked in the Look. The page's own rule sets the axes (`LookStyle`). */
function ReactPlayground({
  look,
  name,
  props,
}: {
  look: PlaygroundLook | undefined;
  name: PlaygroundName;
  props: Props;
}) {
  if (!look) {
    const Element = DIGITAL[name];
    return <Element {...props} />;
  }
  const Element = (look.skin === "hardware" ? HARDWARE : DIGITAL)[name];
  return (
    <div className={reactFrame({ axes: [], skin: look.skin })}>
      <Element {...props} />
    </div>
  );
}

const VUE = {
  fader: () =>
    import("@/registry/bases/shared/audio-ui/elements/vue/Fader.vue"),
  knob: () => import("@/registry/bases/shared/audio-ui/elements/vue/Knob.vue"),
  meter: () =>
    import("@/registry/bases/shared/audio-ui/elements/vue/Meter.vue"),
};

const SVELTE = {
  fader: () =>
    import("@/registry/bases/shared/audio-ui/elements/svelte/Fader.svelte"),
  knob: () =>
    import("@/registry/bases/shared/audio-ui/elements/svelte/Knob.svelte"),
  meter: () =>
    import("@/registry/bases/shared/audio-ui/elements/svelte/Meter.svelte"),
};

const WEB = {
  fader: () => import("@/registry/primitives/fader/web"),
  knob: () => import("@/registry/primitives/knob/web"),
  meter: () => import("@/registry/primitives/meter/web"),
};

/** How a framework puts the element in a target: what unmounts it. */
async function mounter(
  name: PlaygroundName,
  framework: Exclude<Framework, "react">,
  props: Props,
  markup: string
): Promise<(target: HTMLElement) => () => void> {
  if (framework === "vue") {
    const [{ createApp, h }, { default: component }] = await Promise.all([
      import("vue"),
      VUE[name](),
    ]);
    return (target) => {
      const app = createApp({ render: () => h(component, props) });
      app.mount(target);
      return () => app.unmount();
    };
  }
  if (framework === "svelte") {
    const [{ mount, unmount }, { default: component }] = await Promise.all([
      import("svelte"),
      SVELTE[name](),
    ]);
    return (target) => {
      const app = mount(component, { props, target });
      return () => {
        unmount(app);
      };
    };
  }
  await WEB[name]();
  return (target) => {
    target.innerHTML = markup;
    return () => {
      target.innerHTML = "";
    };
  };
}

/** The element in another framework, in a shadow root that holds its sheet alone, and its skin's. Each change mounts it again. */
function FrameworkPlayground({
  framework,
  markup,
  name,
  props,
  skin,
}: {
  framework: Exclude<Framework, "react">;
  markup: string;
  name: PlaygroundName;
  props: Props;
  skin: ShadowSkin | undefined;
}) {
  const host = useRef<HTMLDivElement>(null);
  // The props, the markup and the skin travel in one key: the effect mounts the element again when it changes.
  const key = JSON.stringify({ markup, props, skin });
  useEffect(() => {
    const element = host.current;
    if (!element) {
      return;
    }
    const given = JSON.parse(key) as {
      markup: string;
      props: Props;
      skin?: ShadowSkin;
    };
    let unmount: (() => void) | undefined;
    let gone = false;
    mounter(name, framework, given.props, given.markup).then((mount) => {
      if (!gone) {
        unmount = mountInShadow(element, name, mount, given.skin);
      }
    });
    return () => {
      gone = true;
      unmount?.();
    };
  }, [framework, key, name]);
  return <div className="contents" ref={host} />;
}

/** A playground's element, as the reader set it in the customizer's Component tab. */
export function PlaygroundPreview({
  framework,
  name,
}: {
  framework: Framework;
  name: PlaygroundName;
}) {
  useShownPlayground(name);
  const [values] = usePlayground(name);
  const look = lookFor(framework, useLook());
  const props = Object.fromEntries(propsOf(name, values));
  return framework === "react" ? (
    <ReactPlayground look={look} name={name} props={props} />
  ) : (
    <FrameworkPlayground
      framework={framework}
      markup={webMarkup(name, values)}
      name={name}
      props={props}
      skin={
        look && { ...skinFrame(look), sheet: `/css/skins/${look.skin}.css` }
      }
    />
  );
}

/** The code of a playground as set, for the preview's code panel: reported for its copy button. */
export function PlaygroundSource({
  framework,
  name,
  onCode,
}: {
  framework: Framework;
  name: PlaygroundName;
  onCode: (code: string) => void;
}) {
  const [values] = usePlayground(name);
  const { code, language } = codeOf(name, framework, values, useLook());
  useEffect(() => {
    onCode(code);
  }, [code, onCode]);
  return <HighlightedCode code={code} language={language} />;
}
