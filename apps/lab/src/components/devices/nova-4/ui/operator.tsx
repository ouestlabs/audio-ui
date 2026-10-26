import type { Operator as OperatorNumber } from "../audio/algorithms";
import { RATIOS } from "../audio/engine";
import type { Patch } from "../audio/presets";
import { Dial } from "./dial";
import { type OnParam, ratioText } from "./params";
import { Slider } from "./slider";

const LAST_RATIO = RATIOS.length - 1;

/**
 * One operator's strip: its ratio to the key's pitch, its level, and the decay
 * and sustain of its envelope. The OUT lamp lights when the algorithm makes it
 * a carrier, the one that is heard; dark, it is a modulator, and its level is
 * how bright it makes the one under it.
 */
export function Operator({
  carrier,
  onParam,
  operator,
  patch,
}: {
  carrier: boolean;
  onParam: OnParam;
  operator: OperatorNumber;
  patch: Patch;
}) {
  return (
    <section className="nova-operator">
      <header className="nova-operator-head">
        <h2 className="nova-legend">Op {operator}</h2>
        <span className="nova-out">
          <span
            aria-hidden="true"
            className="nova-led"
            data-on={carrier || undefined}
          />
          {carrier ? "Carrier" : "Mod"}
        </span>
      </header>
      <div className="nova-operator-body">
        <Dial
          label="Ratio"
          max={LAST_RATIO}
          onParam={onParam}
          param={`ratio${operator}`}
          value={patch[`ratio${operator}`]}
          valueText={ratioText}
        />
        <Slider
          label="Level"
          onParam={onParam}
          param={`level${operator}`}
          value={patch[`level${operator}`]}
        />
        <Dial
          label="Decay"
          onParam={onParam}
          param={`decay${operator}`}
          value={patch[`decay${operator}`]}
        />
        <Dial
          label="Sustain"
          onParam={onParam}
          param={`sustain${operator}`}
          value={patch[`sustain${operator}`]}
        />
      </div>
    </section>
  );
}
