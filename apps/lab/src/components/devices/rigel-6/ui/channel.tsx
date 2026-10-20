import { useCallback } from "react";
import type { Channel, Strip } from "../audio/engine";
import { Dial, GAIN, PAN } from "./dial";
import { Slide } from "./fader";
import { Key } from "./key";
import { Levels } from "./meter";
import { LABELS, type OnKnob, type OnStrip } from "./params";

/** One channel of the desk: its EQ, pan, mute and solo, then its fader beside its meter. */
export function ChannelStrip({
  analysers,
  channel,
  onKnob,
  onStrip,
  strip,
}: {
  analysers: readonly AnalyserNode[];
  channel: Channel;
  onKnob: OnKnob;
  onStrip: OnStrip;
  strip: Strip;
}) {
  const slide = useCallback(
    (value: number) => onStrip(channel, "fader", value),
    [channel, onStrip]
  );
  return (
    <section className="rigel-strip">
      <h2 className="rigel-strip-name">{LABELS[channel]}</h2>
      <div className="rigel-knobs">
        <Dial
          cap="red"
          channel={channel}
          label="Hi"
          onKnob={onKnob}
          param="hi"
          scale={GAIN}
          value={strip.hi}
        />
        <Dial
          cap="blue"
          channel={channel}
          label="Lo"
          onKnob={onKnob}
          param="lo"
          scale={GAIN}
          value={strip.lo}
        />
        <Dial
          cap="green"
          channel={channel}
          label="Pan"
          onKnob={onKnob}
          param="pan"
          scale={PAN}
          value={strip.pan}
        />
      </div>
      <div className="rigel-keys">
        <Key
          channel={channel}
          field="mute"
          label="Mute"
          onStrip={onStrip}
          pressed={strip.mute}
        />
        <Key
          channel={channel}
          field="solo"
          label="Solo"
          onStrip={onStrip}
          pressed={strip.solo}
        />
      </div>
      <div className="rigel-slide">
        <Slide
          label={`${LABELS[channel]} level`}
          onChange={slide}
          value={strip.fader}
        />
        {analysers.length > 0 ? (
          <Levels analysers={analysers} label={`${LABELS[channel]} meter`} />
        ) : (
          <div className="rigel-meter" />
        )}
      </div>
    </section>
  );
}
