export const DUCKER_KERNELS = `const module0 = (() => {
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

const db2lin = (db) => Math.pow(10, db / 20)

const lin2db = (lin) => 20 * Math.log10(Math.max(Math.abs(lin), 1e-10))

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

// Feed-forward soft-knee compressor (Giannoulis-Massberg topology).
// Envelope → log domain → gain curve → apply to input.
//
// Downward (above threshold, reduces gain) and upward (below threshold, adds
// gain) compression are the two halves of the canonical four-quadrant dynamics
// taxonomy (Giannoulis, Massberg & Reiss 2012, JAES 60(6); Izhaki, Mixing Audio)
// — upward is the "OTT up" half. Both curves read the same envelope/level in dB
// and sum in the dB domain, so they compose into one continuous transfer.
function compressor(data, opts) {
  if (!(data instanceof Float32Array)) return writer(compressorStream(data))
  let s = compressorStream(opts)
  return concat(s.write(data), s.flush())
}

function compressorStream(opts = {}) {
  let threshold = opts.threshold ?? -20
  let ratio = opts.ratio ?? 4
  let knee = opts.knee ?? 6
  let makeupDb = opts.makeup ?? 0
  let depth = opts.depth ?? 1
  // Upward compression is off by default (upThreshold: null skips the extra
  // curve call entirely). upRatio defaults to 2 at this (kernel) layer once
  // enabled; the params-convention manifest instead defaults upRatio to 1
  // (a mathematical no-op — see audio.js), since it has no null to switch on.
  let upThreshold = opts.upThreshold ?? null
  let upRatio = opts.upRatio ?? 2
  let upKnee = opts.upKnee ?? 6
  let upRange = opts.upRange ?? 12
  let env = envelope({ ...opts, attack: opts.attack ?? 5, release: opts.release ?? 100 })

  return {
    write(chunk) {
      let out = new Float32Array(chunk.length)
      for (let i = 0; i < chunk.length; i++) {
        let x = chunk[i]
        let levelDb = lin2db(env(x))
        let gDb = compressorGain(levelDb, threshold, ratio, knee)
        if (upThreshold != null) gDb += upwardGain(levelDb, upThreshold, upRatio, upKnee, upRange)
        out[i] = x * db2lin(gDb * depth + makeupDb)
      }
      return out
    },
    flush() { return new Float32Array(0) }
  }
}

// Soft-knee downward compression curve. Returns gain reduction in dB (≤ 0).
// Below (T - W/2): no compression. Above (T + W/2): full ratio. In knee: quadratic.
function compressorGain(levelDb, threshold, ratio, kneeDb) {
  let d = levelDb - threshold
  if (d < -kneeDb / 2) return 0
  if (d >= kneeDb / 2) return -(d * (1 - 1 / ratio))
  let x = d + kneeDb / 2
  return -(1 - 1 / ratio) * x * x / (2 * kneeDb)
}

// Soft-knee upward compression curve — the below-threshold complement of
// compressorGain (four-quadrant taxonomy: downward compression engages above
// threshold, upward engages below). Returns gain LIFT in dB (≥ 0), clamped to
// \`rangeDb\` — essential, since without a ceiling silence would take unbounded
// gain. Knee is compressorGain's quadratic reflected about the threshold: off
// above (T + W/2), full ratio below (T - W/2), quadratic interpolation between.
function upwardGain(levelDb, threshold, ratio, kneeDb, rangeDb = 12) {
  let d = levelDb - threshold
  let r
  if (d >= kneeDb / 2) r = 0
  else if (d <= -kneeDb / 2) r = -d * (1 - 1 / ratio)
  else {
    let x = kneeDb / 2 - d
    r = (1 - 1 / ratio) * x * x / (2 * kneeDb)
  }
  return r > rangeDb ? rangeDb : r
}

return { compressorGain, default: compressor };
})();

const module4 = (() => {
// Local helpers (inlined family convention — no shared-dep package).

// e^(dB·ln10/20) and ln·20/ln10, not 10^(dB/20) and 20·log10: half the cost in V8 (exp and log take ~9 ns, pow
// and log10 ~17-19), a few double ulps from them, far under a float32 ulp.
const db2lin = (db) => Math.exp(db * (Math.LN10 / 20))

const lin2db = (lin) => 20 / Math.LN10 * Math.log(Math.max(Math.abs(lin), 1e-10))

// Two-input variant for ducker/sidechain.
function writer2(s) {
  return (main, side) => main ? s.write(main, side || main) : s.flush()
}

function concat(a, b) {
  if (!b || !b.length) return a
  if (!a.length) return b
  let out = new Float32Array(a.length + b.length)
  out.set(a)
  out.set(b, a.length)
  return out
}

return { db2lin, lin2db };
})();

const ducker = (() => {
const { envelope } = module1;
const { compressorGain } = module3;
const { db2lin, lin2db } = module4;
// atom manifest — wraps the external-sidechain ducker kernel per @audio/compile
// CONTRACT §channels. The kernel cleanly separates the key input (duckerStream.write(main,
// side) takes two distinct signals), so this declares a genuine two-bus layout: main +
// sidechain in, main out — mirrors the compressor pilot's live-param style (compressorGain
// is a pure per-sample curve, same as compressor.js; only attack/release seed the envelope
// at construction).
//
// NOTE: the audio host feeds bus 1 from its \`key\` option (chain.ducker({ key }) — rendered
// per block, rate-reconciled). When no key is given, or a host feeds only bus 0,
// \`inputs[1]\` arrives undefined and this falls back to keying off the main signal itself
// (self-compression, not true ducking).

const ducker = (ctx) => {
	const envs = []
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) envs.push(envelope({
		sampleRate: ctx.sampleRate,
		attack: ctx.params.attack[0],
		release: ctx.params.release[0],
	}))
	return (inputs, outputs, params) => {
		const main = inputs[0], side = inputs[1], out = outputs[0]
		if (!main || !main.length) return
		const threshold = params.threshold[0], ratio = params.ratio[0]
		const knee = params.knee[0], range = params.range[0]
		for (let c = 0; c < main.length; c++) {
			const x = main[c], y = out[c], env = envs[c]
			const key = side && side[c] ? side[c] : x
			for (let i = 0; i < x.length; i++) {
				let rDb = compressorGain(lin2db(env(key[i])), threshold, ratio, knee)
				if (rDb < range) rDb = range
				y[i] = x[i] * db2lin(rDb)
			}
		}
	}
}
ducker.channels = { inputs: [2, 2], outputs: [2] }
ducker.tail = 0
ducker.params = {
	threshold: { type: 'number', min: -60, max: 0, default: -30, smoothing: 0.01, unit: 'dB' },
	ratio:     { type: 'number', min: 1, max: 20, default: 4 },
	knee:      { type: 'number', min: 0, max: 24, default: 6, unit: 'dB' },
	range:     { type: 'number', min: -90, max: 0, default: -24, unit: 'dB' },
	attack:    { type: 'number', min: 0.1, max: 200, default: 20, unit: 'ms', flags: ['restart'] },
	release:   { type: 'number', min: 1, max: 2000, default: 300, unit: 'ms', flags: ['restart'] },
}

return ducker;
})();
`;