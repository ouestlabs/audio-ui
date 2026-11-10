/**
 * audio.js kernels, each module as published, in its own scope, for an
 * `AudioWorklet`, which cannot import them:
 * - `@audio/dynamics-envelope` 0.1.4 (MIT, Dmitry Iv.): `timeCoef`, as `module0`
 * - `@audio/dynamics-envelope` 0.1.4 (MIT, Dmitry Iv.): `envelope`, as `module1`
 * - `@audio/dynamics-expander` 0.2.2 (MIT, Dmitry Iv.): `writer`, `concat`, `db2lin`, `lin2db`, as `module2`
 * - `@audio/dynamics-expander` 0.2.2 (MIT, Dmitry Iv.): `expanderGain`, `upwardExpanderGain`, as `module3`
 * - `@audio/dynamics-expander` 0.2.2 (MIT, Dmitry Iv.): `expander`
 */
export const EXPANDER_KERNELS = `const module0 = (() => {
// Local helpers (inlined family convention — no shared-dep package).

// One-pole smoothing coefficient: y[n] = c·y[n-1] + (1-c)·x[n]. ms → coefficient.
function timeCoef(ms, sampleRate) {
  if (ms <= 0) return 0
  return Math.exp(-1 / (ms * 0.001 * sampleRate))
}

return { timeCoef };
})();

const module1 = (() => {
const { timeCoef } = module0;

// Branching one-pole envelope follower. Returns a stateful per-sample detector.
// Separate attack and release time constants; the classic feed-forward compressor
// topology. Peak or RMS detection selectable.
function envelope(opts = {}) {
  // sampleRate is this family's documented key; fs accepted too — half the ecosystem
  // (and dynamics' own fs-named atoms: multiband, leveler, transient-shaper) passes fs,
  // and silently falling back to 44100 skews ballistics at any other rate.
  let sr = opts.sampleRate ?? opts.fs ?? 44100
  let aa = timeCoef(opts.attack ?? 5, sr)
  let ar = timeCoef(opts.release ?? 50, sr)
  let detector = opts.detector || 'peak'
  let rmsWin = Math.max(1, opts.rmsWindow || 256)

  let rmsBuf = detector === 'rms' ? new Float32Array(rmsWin) : null
  let rmsSum = 0
  let rmsIdx = 0
  let env = 0

  return function detect(x) {
    let mag
    if (detector === 'rms') {
      let sq = x * x
      rmsSum += sq - rmsBuf[rmsIdx]
      rmsBuf[rmsIdx] = sq
      rmsIdx = (rmsIdx + 1) % rmsWin
      mag = Math.sqrt(Math.max(0, rmsSum / rmsWin))
    } else {
      mag = x < 0 ? -x : x
    }
    let c = mag > env ? aa : ar
    env = c * env + (1 - c) * mag
    return env
  }
}

return { envelope };
})();

const module2 = (() => {
// Local helpers (inlined family convention — no shared-dep package).

// e^(dB·ln10/20) and ln·20/ln10, not 10^(dB/20) and 20·log10: half the cost in V8 (exp and log take ~9 ns, pow
// and log10 ~17-19), a few double ulps from them, far under a float32 ulp.
const db2lin = (db) => Math.exp(db * (Math.LN10 / 20))

const lin2db = (lin) => 20 / Math.LN10 * Math.log(Math.max(Math.abs(lin), 1e-10))

// Wrap { write, flush } into a single callable: write(chunk) → process, write() → flush.
function writer(s) {
  return (chunk) => chunk ? s.write(chunk) : s.flush()
}

function concat(a, b) {
  if (!b || !b.length) return a
  if (!a.length) return b
  let out = new Float32Array(a.length + b.length)
  out.set(a)
  out.set(b, a.length)
  return out
}

return { writer, concat, db2lin, lin2db };
})();

const module3 = (() => {
const { envelope } = module1;
const { writer, concat, db2lin, lin2db } = module2;

// Downward expander (\`mode: 'downward'\`, default): reduces gain below threshold
// by (T-L)·(ratio-1) dB, clamped at \`range\` dB of max reduction. Softer than a gate.
//
// Upward expander (\`mode: 'upward'\`): the de-compression complement — raises
// gain ABOVE threshold instead, undoing over-squashed dynamics. Four-quadrant
// dynamics taxonomy (Giannoulis, Massberg & Reiss 2012, JAES 60(6); Izhaki,
// Mixing Audio): downward/upward compression + downward/upward expansion.
// Classical substrate for de-limiting: transient-aware upward expansion
// restores crest factor a brickwall limiter flattened.
function expander(data, opts) {
  if (!(data instanceof Float32Array)) return writer(expanderStream(data))
  let s = expanderStream(opts)
  return concat(s.write(data), s.flush())
}

function expanderStream(opts = {}) {
  let mode = opts.mode ?? 'downward'
  let threshold = opts.threshold ?? -30
  let ratio = opts.ratio ?? 2
  let knee = opts.knee ?? 6
  // range's sign follows mode: downward is a max-reduction floor (negative),
  // upward is a max-lift ceiling (positive) — same shape as compressor's upRange.
  let range = opts.range ?? (mode === 'upward' ? 20 : -40)
  let gain = mode === 'upward' ? upwardExpanderGain : expanderGain
  let env = envelope(opts)

  return {
    write(chunk) {
      let out = new Float32Array(chunk.length)
      for (let i = 0; i < chunk.length; i++) {
        let x = chunk[i]
        let rDb = gain(lin2db(env(x)), threshold, ratio, knee, range)
        out[i] = x * db2lin(rDb)
      }
      return out
    },
    flush() { return new Float32Array(0) }
  }
}

// Soft-knee downward expansion curve. Returns gain reduction in dB (≤ 0).
function expanderGain(levelDb, threshold, ratio, kneeDb, rangeDb) {
  let d = levelDb - threshold
  let r
  if (d > kneeDb / 2) r = 0
  else if (d <= -kneeDb / 2) r = d * (ratio - 1)
  else {
    let x = d - kneeDb / 2
    r = -(ratio - 1) * x * x / (2 * kneeDb)
  }
  return r < rangeDb ? rangeDb : r
}

// Soft-knee upward expansion curve — the above-threshold complement of
// expanderGain. Returns gain LIFT in dB (≥ 0), clamped to \`rangeDb\`. Same
// engagement topology as compressorGain (off below threshold, engaged above);
// positive instead of negative, (ratio-1) coefficient instead of (1-1/ratio)
// — expander ratios are "dB out per dB in" beyond threshold, compressor
// ratios are "dB in per dB out".
function upwardExpanderGain(levelDb, threshold, ratio, kneeDb, rangeDb) {
  let d = levelDb - threshold
  let r
  if (d <= -kneeDb / 2) r = 0
  else if (d > kneeDb / 2) r = d * (ratio - 1)
  else {
    let x = d + kneeDb / 2
    r = (ratio - 1) * x * x / (2 * kneeDb)
  }
  return r > rangeDb ? rangeDb : r
}

return { expanderGain, upwardExpanderGain, default: expander };
})();

const expander = (() => {
const { envelope } = module1;
const { expanderGain, upwardExpanderGain } = module3;
const { db2lin, lin2db } = module2;
// atom manifest — wraps the dynamics expander kernel per @audio/compile CONTRACT.
// Mirrors the compressor pilot: expanderGain/upwardExpanderGain are pure per-sample
// gain curves just like compressorGain, so threshold/ratio/knee/range stay live; only
// attack/release seed the envelope follower at construction (flags: restart).
// \`mode\` picks the curve (enum pattern mirrors deesser's \`mode\`): 'downward' (default)
// reduces gain below threshold; 'upward' raises gain above threshold — de-compression,
// the substrate for de-limiting over-squashed material. No restart needed — both
// curves share the same envelope shape, only the gain formula switches.
// \`range\` is exposed as a magnitude (≥ 0), sign-applied by mode inside the processor,
// so switching modes can never strand a stale sign-mismatched value.

const expander = (ctx) => {
	const envs = []
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) envs.push(envelope({
		sampleRate: ctx.sampleRate,
		attack: ctx.params.attack[0],
		release: ctx.params.release[0],
	}))
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		const threshold = params.threshold[0], ratio = params.ratio[0], knee = params.knee[0]
		const upward = params.mode === 'upward'
		const range = upward ? params.range[0] : -params.range[0]
		const gainFn = upward ? upwardExpanderGain : expanderGain
		for (let c = 0; c < inp.length; c++) {
			const x = inp[c], y = out[c], env = envs[c]
			for (let i = 0; i < x.length; i++) {
				const rDb = gainFn(lin2db(env(x[i])), threshold, ratio, knee, range)
				y[i] = x[i] * db2lin(rDb)
			}
		}
	}
}
expander.channels = 'any'
expander.tail = 0
expander.params = {
	mode:      { type: 'enum', values: ['downward', 'upward'], default: 'downward' },
	threshold: { type: 'number', min: -80, max: 0, default: -30, smoothing: 0.01, unit: 'dB' },
	ratio:     { type: 'number', min: 1, max: 20, default: 2 },
	knee:      { type: 'number', min: 0, max: 24, default: 6, unit: 'dB' },
	range:     { type: 'number', min: 0, max: 90, default: 40, unit: 'dB' },
	attack:    { type: 'number', min: 0.1, max: 100, default: 5, unit: 'ms', flags: ['restart'] },
	release:   { type: 'number', min: 1, max: 1000, default: 50, unit: 'ms', flags: ['restart'] },
}

return expander;
})();
`;
