/**
 * audio.js kernels, each module as published, in its own scope, for an
 * `AudioWorklet`, which cannot import them:
 * - `@audio/dynamics-envelope` 0.1.4 (MIT, Dmitry Iv.): `timeCoef`, as `module0`
 * - `@audio/dynamics-envelope` 0.1.4 (MIT, Dmitry Iv.): `envelope`, as `module1`
 * - `@audio/dynamics-compressor` 0.2.1 (MIT, Dmitry Iv.): `writer`, `concat`, `db2lin`, `lin2db`, as `module2`
 * - `@audio/dynamics-compressor` 0.2.1 (MIT, Dmitry Iv.): `compressorGain`, as `module3`
 * - `@audio/dynamics-vca` 0.2.5 (MIT, Dmitry Iv.): `writer`, `concat`, `db2lin`, `lin2db`, `timeCoef`, as `module4`
 * - `@audio/dynamics-vca` 0.2.5 (MIT, Dmitry Iv.): `vcaStream`, as `module5`
 * - `@audio/dynamics-vca` 0.2.5 (MIT, Dmitry Iv.): `vca`
 * - `@audio/dynamics-fet` 0.2.5 (MIT, Dmitry Iv.): `writer`, `concat`, `db2lin`, `lin2db`, `timeCoef`, as `module7`
 * - `@audio/dynamics-fet` 0.2.5 (MIT, Dmitry Iv.): `fetStream`, as `module8`
 * - `@audio/dynamics-fet` 0.2.5 (MIT, Dmitry Iv.): `fet`
 * - `@audio/dynamics-opto` 0.2.5 (MIT, Dmitry Iv.): `writer`, `concat`, `db2lin`, `lin2db`, `timeCoef`, as `module10`
 * - `@audio/dynamics-opto` 0.2.5 (MIT, Dmitry Iv.): `optoStream`, as `module11`
 * - `@audio/dynamics-opto` 0.2.5 (MIT, Dmitry Iv.): `opto`
 * - `@audio/dynamics-varimu` 0.2.4 (MIT, Dmitry Iv.): `writer`, `concat`, `db2lin`, `lin2db`, `timeCoef`, as `module13`
 * - `@audio/dynamics-varimu` 0.2.4 (MIT, Dmitry Iv.): `varimuStream`, as `module14`
 * - `@audio/dynamics-varimu` 0.2.4 (MIT, Dmitry Iv.): `varimu`
 * - `@audio/dynamics-compressor` 0.3.1 (MIT, Dmitry Iv.): `writer`, `concat`, `db2lin`, `lin2db`, `timeCoef`, as `module16`
 * - `@audio/dynamics-compressor` 0.3.1 (MIT, Dmitry Iv.): `compress`, `compressorState`, as `module17`
 * - `@audio/dynamics-compressor` 0.3.1 (MIT, Dmitry Iv.): `compressor`
 */
export const COMPRESSOR_KERNELS = `const module0 = (() => {
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

return { compressorGain };
})();

const module4 = (() => {
// Local helpers (inlined family convention — no shared-dep package).

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

// e^(dB·ln10/20) and ln·20/ln10, not 10^(dB/20) and 20·log10: half the cost in V8 (exp and log take ~9 ns, pow
// and log10 ~17-19), a few double ulps from them, far under a float32 ulp.
const db2lin = (db) => Math.exp(db * (Math.LN10 / 20))

const lin2db = (lin) => 20 / Math.LN10 * Math.log(Math.max(Math.abs(lin), 1e-10))

// One-pole smoothing coefficient: y[n] = c·y[n-1] + (1-c)·x[n]. ms → coefficient.
function timeCoef(ms, sampleRate) {
  if (ms <= 0) return 0
  return Math.exp(-1 / (ms * 0.001 * sampleRate))
}

return { writer, concat, db2lin, lin2db, timeCoef };
})();

const module5 = (() => {
const { envelope } = module1;
const { compressorGain } = module3;
const { writer, concat, db2lin, lin2db, timeCoef } = module4;
// VCA compressor model (dbx/SSL-bus class) — clean feed-forward peak detection,
// near-hard knee, precise dB-linear gain computation. The transparent workhorse.

function vca (data, opts) {
	if (!(data instanceof Float32Array)) return writer(vcaStream(data))
	let s = vcaStream(opts)
	return concat(s.write(data), s.flush())
}

function vcaStream (opts = {}) {
	let sr = opts.sampleRate || opts.fs || 44100
	let threshold = opts.threshold ?? -20
	let ratio = opts.ratio ?? 4
	let knee = opts.knee ?? 1
	let makeup = opts.makeup ?? 0
	let env = envelope({ ...opts, sampleRate: sr, detector: 'peak', attack: opts.attack ?? 1, release: 1 })
	let gr = 0
	let aCoef = timeCoef(opts.attack ?? 1, sr)
	let rCoef = timeCoef(opts.release ?? 150, sr)

	return {
		write (chunk) {
			let out = new Float32Array(chunk.length)
			for (let i = 0; i < chunk.length; i++) {
				let target = compressorGain(lin2db(env(chunk[i])), threshold, ratio, knee)
				gr = target < gr ? target + (gr - target) * aCoef : target + (gr - target) * rCoef
				out[i] = chunk[i] * db2lin(gr + makeup)
			}
			return out
		},
		flush () { return new Float32Array(0) }
	}
}

return { vcaStream };
})();

const vca = (() => {
const { vcaStream } = module5;
// atom manifest — VCA compressor (dbx/SSL-bus class: clean feed-forward peak
// detection, near-hard knee, dB-linear gain). Per-channel streaming writer;
// params bake at construction — flags:['restart'].

const vca = (ctx) => {
	const chans = []
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) chans.push(vcaStream({
		sampleRate: ctx.sampleRate,
		threshold: ctx.params.threshold[0],
		ratio: ctx.params.ratio[0],
		knee: ctx.params.knee[0],
		attack: ctx.params.attack[0],
		release: ctx.params.release[0],
		makeup: ctx.params.makeup[0],
	}))
	return (inputs, outputs) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		for (let c = 0; c < inp.length; c++) out[c].set(chans[c].write(inp[c]))
	}
}
vca.channels = 'any'
vca.tail = 0.3
vca.params = {
	threshold: { type: 'number', min: -60, max: 0, default: -20, unit: 'dB', flags: ['restart'] },
	ratio:     { type: 'number', min: 1, max: 20, default: 4, flags: ['restart'] },
	knee:      { type: 'number', min: 0, max: 12, default: 1, unit: 'dB', flags: ['restart'] },
	attack:    { type: 'number', min: 0.1, max: 100, default: 1, unit: 'ms', flags: ['restart'] },
	release:   { type: 'number', min: 20, max: 2000, default: 150, unit: 'ms', flags: ['restart'] },
	makeup:    { type: 'number', min: -12, max: 24, default: 0, unit: 'dB', flags: ['restart'] },
}

return vca;
})();

const module7 = (() => {
// Local helpers (inlined family convention — no shared-dep package).

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

// e^(dB·ln10/20) and ln·20/ln10, not 10^(dB/20) and 20·log10: half the cost in V8 (exp and log take ~9 ns, pow
// and log10 ~17-19), a few double ulps from them, far under a float32 ulp.
const db2lin = (db) => Math.exp(db * (Math.LN10 / 20))

const lin2db = (lin) => 20 / Math.LN10 * Math.log(Math.max(Math.abs(lin), 1e-10))

// One-pole smoothing coefficient: y[n] = c·y[n-1] + (1-c)·x[n]. ms → coefficient.
function timeCoef(ms, sampleRate) {
  if (ms <= 0) return 0
  return Math.exp(-1 / (ms * 0.001 * sampleRate))
}

return { writer, concat, db2lin, lin2db, timeCoef };
})();

const module8 = (() => {
const { envelope } = module1;
const { compressorGain } = module3;
const { writer, concat, db2lin, lin2db, timeCoef } = module7;
// FET compressor model (1176 class) — very fast peak detection (0.2 ms default attack),
// fixed-style high ratios, firm knee. Character = speed, not color.

function fet (data, opts) {
	if (!(data instanceof Float32Array)) return writer(fetStream(data))
	let s = fetStream(opts)
	return concat(s.write(data), s.flush())
}

function fetStream (opts = {}) {
	let sr = opts.sampleRate || opts.fs || 44100
	let threshold = opts.threshold ?? -18
	let ratio = opts.ratio ?? 8
	let knee = opts.knee ?? 3
	let makeup = opts.makeup ?? 0
	let env = envelope({ ...opts, sampleRate: sr, detector: 'peak', attack: opts.attack ?? 0.2, release: 1 })
	let gr = 0
	let aCoef = timeCoef(opts.attack ?? 0.2, sr)
	let rCoef = timeCoef(opts.release ?? 120, sr)

	return {
		write (chunk) {
			let out = new Float32Array(chunk.length)
			for (let i = 0; i < chunk.length; i++) {
				let target = compressorGain(lin2db(env(chunk[i])), threshold, ratio, knee)
				gr = target < gr ? target + (gr - target) * aCoef : target + (gr - target) * rCoef
				out[i] = chunk[i] * db2lin(gr + makeup)
			}
			return out
		},
		flush () { return new Float32Array(0) }
	}
}

return { fetStream };
})();

const fet = (() => {
const { fetStream } = module8;
// atom manifest — FET compressor (1176 class: very fast peak detection, high ratios,
// firm knee). The kernel is a per-channel streaming writer whose params bake into the
// envelope/coefficients at construction — all params carry flags:['restart'].

const fet = (ctx) => {
	const chans = []
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) chans.push(fetStream({
		sampleRate: ctx.sampleRate,
		threshold: ctx.params.threshold[0],
		ratio: ctx.params.ratio[0],
		knee: ctx.params.knee[0],
		attack: ctx.params.attack[0],
		release: ctx.params.release[0],
		makeup: ctx.params.makeup[0],
	}))
	return (inputs, outputs) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		for (let c = 0; c < inp.length; c++) out[c].set(chans[c].write(inp[c]))
	}
}
fet.channels = 'any'
fet.tail = 0.3
fet.params = {
	threshold: { type: 'number', min: -60, max: 0, default: -18, unit: 'dB', flags: ['restart'] },
	ratio:     { type: 'number', min: 4, max: 20, default: 8, flags: ['restart'] },
	knee:      { type: 'number', min: 0, max: 12, default: 3, unit: 'dB', flags: ['restart'] },
	attack:    { type: 'number', min: 0.02, max: 5, default: 0.2, unit: 'ms', flags: ['restart'] },
	release:   { type: 'number', min: 20, max: 1000, default: 120, unit: 'ms', flags: ['restart'] },
	makeup:    { type: 'number', min: -12, max: 24, default: 0, unit: 'dB', flags: ['restart'] },
}

return fet;
})();

const module10 = (() => {
// Local helpers (inlined family convention — no shared-dep package).

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

// e^(dB·ln10/20) and ln·20/ln10, not 10^(dB/20) and 20·log10: half the cost in V8 (exp and log take ~9 ns, pow
// and log10 ~17-19), a few double ulps from them, far under a float32 ulp.
const db2lin = (db) => Math.exp(db * (Math.LN10 / 20))

const lin2db = (lin) => 20 / Math.LN10 * Math.log(Math.max(Math.abs(lin), 1e-10))

// One-pole smoothing coefficient: y[n] = c·y[n-1] + (1-c)·x[n]. ms → coefficient.
function timeCoef(ms, sampleRate) {
  if (ms <= 0) return 0
  return Math.exp(-1 / (ms * 0.001 * sampleRate))
}

return { writer, concat, db2lin, lin2db, timeCoef };
})();

const module11 = (() => {
const { envelope } = module1;
const { compressorGain } = module3;
const { writer, concat, db2lin, lin2db, timeCoef } = module10;
// Optical compressor model (LA-2A class) — RMS detection, wide soft knee, ~3:1, and the
// T4 signature: program-dependent release that slows the longer gain reduction persists.

function opto (data, opts) {
	if (!(data instanceof Float32Array)) return writer(optoStream(data))
	let s = optoStream(opts)
	return concat(s.write(data), s.flush())
}

function optoStream (opts = {}) {
	let sr = opts.sampleRate || opts.fs || 44100
	let threshold = opts.threshold ?? -20
	let ratio = opts.ratio ?? 3
	let knee = opts.knee ?? 10
	let makeup = opts.makeup ?? 0
	let env = envelope({ ...opts, sampleRate: sr, detector: 'rms', attack: opts.attack ?? 10, release: 1 })
	let gr = 0                       // smoothed gain reduction (dB, ≤0)
	let memory = 0                   // integrates time-under-reduction → slows release (T4 cell)
	let memCoef = timeCoef(3000, sr) // ~3 s history
	let aCoef = timeCoef(opts.attack ?? 10, sr)

	return {
		write (chunk) {
			let out = new Float32Array(chunk.length)
			for (let i = 0; i < chunk.length; i++) {
				let target = compressorGain(lin2db(env(chunk[i])), threshold, ratio, knee)
				memory = memory * memCoef + (target < -1 ? 1 - memCoef : 0)
				let relMs = (opts.release ?? 300) * (1 + 6 * memory)
				let rCoef = timeCoef(relMs, sr)
				gr = target < gr ? target + (gr - target) * aCoef : target + (gr - target) * rCoef
				out[i] = chunk[i] * db2lin(gr + makeup)
			}
			return out
		},
		flush () { return new Float32Array(0) }
	}
}

return { optoStream };
})();

const opto = (() => {
const { optoStream } = module11;
// atom manifest — optical compressor (LA-2A class: RMS detection, wide soft knee,
// ~3:1, T4 program-dependent release that slows the longer reduction persists).
// Per-channel streaming writer; params bake at construction — flags:['restart'].

const opto = (ctx) => {
	const chans = []
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) chans.push(optoStream({
		sampleRate: ctx.sampleRate,
		threshold: ctx.params.threshold[0],
		ratio: ctx.params.ratio[0],
		knee: ctx.params.knee[0],
		attack: ctx.params.attack[0],
		makeup: ctx.params.makeup[0],
	}))
	return (inputs, outputs) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		for (let c = 0; c < inp.length; c++) out[c].set(chans[c].write(inp[c]))
	}
}
opto.channels = 'any'
opto.tail = 1  // T4 memory cell integrates ~3 s of reduction history; release rides it
opto.params = {
	threshold: { type: 'number', min: -60, max: 0, default: -20, unit: 'dB', flags: ['restart'] },
	ratio:     { type: 'number', min: 1.5, max: 6, default: 3, flags: ['restart'] },
	knee:      { type: 'number', min: 4, max: 24, default: 10, unit: 'dB', flags: ['restart'] },
	attack:    { type: 'number', min: 1, max: 100, default: 10, unit: 'ms', flags: ['restart'] },
	makeup:    { type: 'number', min: -12, max: 24, default: 0, unit: 'dB', flags: ['restart'] },
}

return opto;
})();

const module13 = (() => {
// Local helpers (inlined family convention — no shared-dep package).

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

const db2lin = (db) => Math.pow(10, db / 20)

const lin2db = (lin) => 20 * Math.log10(Math.max(Math.abs(lin), 1e-10))

// One-pole smoothing coefficient: y[n] = c·y[n-1] + (1-c)·x[n]. ms → coefficient.
function timeCoef(ms, sampleRate) {
  if (ms <= 0) return 0
  return Math.exp(-1 / (ms * 0.001 * sampleRate))
}

return { writer, concat, db2lin, lin2db, timeCoef };
})();

const module14 = (() => {
const { envelope } = module1;
const { compressorGain } = module3;
const { writer, concat, db2lin, lin2db, timeCoef } = module13;
// Vari-Mu compressor model (Fairchild class) — feedback topology (detector reads the
// output), very soft wide knee, slow attack, and ratio that grows with drive (the "mu").

function varimu (data, opts) {
	if (!(data instanceof Float32Array)) return writer(varimuStream(data))
	let s = varimuStream(opts)
	return concat(s.write(data), s.flush())
}

function varimuStream (opts = {}) {
	let sr = opts.sampleRate || opts.fs || 44100
	let threshold = opts.threshold ?? -22
	let knee = opts.knee ?? 15
	let makeup = opts.makeup ?? 0
	let env = envelope({ ...opts, sampleRate: sr, detector: 'rms', attack: opts.attack ?? 25, release: 1 })
	let gr = 0
	let aCoef = timeCoef(opts.attack ?? 25, sr)
	let rCoef = timeCoef(opts.release ?? 400, sr)

	return {
		write (chunk) {
			let out = new Float32Array(chunk.length)
			for (let i = 0; i < chunk.length; i++) {
				let y = chunk[i] * db2lin(gr)           // feedback: detect the compressed output
				let over = lin2db(env(y)) - threshold
				let mu = 1.8 + Math.max(0, over) / 5    // ratio grows with drive
				let target = compressorGain(lin2db(env(y)) , threshold, mu, knee)
				gr = target < gr ? target + (gr - target) * aCoef : target + (gr - target) * rCoef
				out[i] = chunk[i] * db2lin(gr + makeup)
			}
			return out
		},
		flush () { return new Float32Array(0) }
	}
}

return { varimuStream };
})();

const varimu = (() => {
const { varimuStream } = module14;
// atom manifest — vari-mu compressor (Fairchild class: feedback topology, very soft
// wide knee, slow attack, ratio grows with drive). Per-channel streaming writer;
// params bake at construction — flags:['restart'].

const varimu = (ctx) => {
	const chans = []
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) chans.push(varimuStream({
		sampleRate: ctx.sampleRate,
		threshold: ctx.params.threshold[0],
		knee: ctx.params.knee[0],
		attack: ctx.params.attack[0],
		release: ctx.params.release[0],
		makeup: ctx.params.makeup[0],
	}))
	return (inputs, outputs) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		for (let c = 0; c < inp.length; c++) out[c].set(chans[c].write(inp[c]))
	}
}
varimu.channels = 'any'
varimu.tail = 0.5
varimu.params = {
	threshold: { type: 'number', min: -60, max: 0, default: -22, unit: 'dB', flags: ['restart'] },
	knee:      { type: 'number', min: 6, max: 30, default: 15, unit: 'dB', flags: ['restart'] },
	attack:    { type: 'number', min: 5, max: 200, default: 25, unit: 'ms', flags: ['restart'] },
	release:   { type: 'number', min: 50, max: 2000, default: 400, unit: 'ms', flags: ['restart'] },
	makeup:    { type: 'number', min: -12, max: 24, default: 0, unit: 'dB', flags: ['restart'] },
}

return varimu;
})();

const module16 = (() => {
// Local helpers (inlined family convention — no shared-dep package).

// e^(dB·ln10/20) and ln·20/ln10, not 10^(dB/20) and 20·log10: half the cost in V8 (exp and log take ~9 ns, pow
// and log10 ~17-19), a few double ulps from them, far under a float32 ulp.
const db2lin = (db) => Math.exp(db * (Math.LN10 / 20))

const lin2db = (lin) => 20 / Math.LN10 * Math.log(Math.max(Math.abs(lin), 1e-10))

// One-pole smoothing coefficient, α = e^(−1/(τ·fs)) (Giannoulis et al. 2012, eq. 7): τ in ms reaches 1 − 1/e.
function timeCoef(ms, sampleRate) {
  if (ms <= 0) return 0
  return Math.exp(-1 / (ms * 0.001 * sampleRate))
}

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

return { writer, concat, db2lin, lin2db, timeCoef };
})();

const module17 = (() => {
const { writer, concat, db2lin, lin2db, timeCoef } = module16;

// Feed-forward compressor as Giannoulis, Massberg & Reiss recommend (JAES 60(6), 2012, §5): the gain computer
// reads the level in dB, eq. (4), and its gain reduction is smoothed in the log domain after it, eq. (23), by
// the smooth decoupled peak detector, eq. (17). Attack and release are then the time constants, eq. (7), of the
// gain reduction itself at any level. A detector on the linear signal before the gain computer (their Fig. 7a,
// JUCE's dsp::Compressor) lags the attack while it charges up to the threshold and releases in a straight line
// in dB, longer the deeper the compression: 5 and 100 ms act as 2.8-10.6 and 22-146 ms from 3 to 20 dB over.
//
// Downward (above threshold, reduces gain) and upward (below threshold, adds gain) compression are the two
// halves of the four-quadrant dynamics taxonomy (Giannoulis et al. 2012; Izhaki, Mixing Audio): upward is the
// "OTT up" half. Both curves read the same level and sum in dB, one continuous transfer, smoothed as one.
function compressor(data, opts) {
  if (!(data instanceof Float32Array)) return writer(compressorStream(data))
  let s = compressorStream(opts)
  return concat(s.write(data), s.flush())
}

function compressorStream(opts = {}) {
  let sr = opts.sampleRate ?? opts.fs ?? 44100
  let makeupDb = opts.makeup ?? 0
  let depth = opts.depth ?? 1
  // Upward compression is off by default (upThreshold: null skips its curve). upRatio defaults to 2 at this
  // (kernel) layer once enabled; the params-convention manifest defaults upRatio to 1 instead (a mathematical
  // no-op, see audio.js), since it has no null to switch on.
  let curve = {
    threshold: opts.threshold ?? -20, ratio: opts.ratio ?? 4, knee: opts.knee ?? 6,
    upThreshold: opts.upThreshold ?? null, upRatio: opts.upRatio ?? 2, upKnee: opts.upKnee ?? 6, upRange: opts.upRange ?? 12,
  }
  let st = compressorState(opts.attack ?? 5, opts.release ?? 100, sr, opts.detector, opts.rmsWindow)

  return {
    write(chunk) { return compress(chunk, new Float32Array(chunk.length), st, curve, depth, makeupDb) },
    flush() { return new Float32Array(0) }
  }
}

/** One channel's running state: the smoother's coefficients and poles, eq. (17), and the RMS window. */
function compressorState(attack, release, sampleRate, type = 'peak', win = 256) {
  let rms = type === 'rms', n = rms ? Math.max(1, win) : 0
  return { aA: timeCoef(attack, sampleRate), aR: timeCoef(release, sampleRate), y1: 0, y: 0, rms, n, buf: new Float64Array(n), sum: 0, i: 0 }
}

/** Compress block \`x\` into \`out\` and return it: \`detector\`, \`gainDb\` and \`smoother\` as one loop over locals,
 *  the state carried in \`s\` from block to block. Gain 10^((−y·depth + makeup)/20). */
function compress(x, out, s, c, depth = 1, makeup = 0) {
  let { aA, aR, rms, n, buf } = s, bA = 1 - aA, bR = 1 - aR, y1 = s.y1, y = s.y, sum = s.sum, j = s.i
  let T = c.threshold, R = c.ratio, K = c.knee, uT = c.upThreshold, uR = c.upRatio, uK = c.upKnee, uG = c.upRange
  let up = uT != null
  // Level: |x| in dB, or the window's mean square in dB (10·log10), floored at −200 dB
  let floor = rms ? 1e-20 : 1e-10, k = (rms ? 10 : 20) / Math.LN10
  // Under T − K/2 the downward curve is exactly 0, over uT + uK/2 the upward one exactly its resting value (and
  // everywhere when upRatio is 1): between, the gain is known without the level, so the log is taken only off
  // this band. Its edges are compared in the linear level, set 1e-9 inside (~1e-8 dB), far over the log's
  // rounding, so a level in the band is one the dB comparison puts there too. Absurd thresholds (~1e3 dB, where
  // that rounding nears the margin) or NaN leave the band empty: every sample then takes the log.
  let hi = Math.abs(T) + Math.abs(K) < 1e3 ? Math.exp((T - K / 2) / k) * (1 - 1e-9) : -1
  if (!(hi > floor)) hi = -1
  let lo = !up ? -1 : !(Math.abs(uT) + Math.abs(uK) < 1e3) ? Infinity : uR === 1 ? -1 : Math.exp((uT + uK / 2) / k) * (1 + 1e-9)
  let g0 = hi > lo ? gainDb(k * Math.log(hi), c) : 0

  for (let i = 0; i < x.length; i++) {
    let v = x[i], l
    if (rms) {
      let sq = v * v
      sum += sq - buf[j]; buf[j] = sq; j = (j + 1) % n
      l = sum / n
    } else l = Math.abs(v)
    let g = g0
    if (!(l > lo && l < hi)) {
      let db = k * Math.log(Math.max(l, floor))
      g = compressorGain(db, T, R, K)
      if (up) g += upwardGain(db, uT, uR, uK, uG)
    }
    // smoother(), eq. (17), on the reduction −g, inline
    let r = aR * y1 + bR * -g
    y1 = -g > r ? -g : r
    y = aA * y + bA * y1
    out[i] = v * db2lin(-y * depth + makeup)
  }
  s.y1 = y1; s.y = y; s.sum = sum; s.i = j
  return out
}

/** Static gain, dB, at level \`db\`: the downward curve, plus the upward lift when \`upThreshold\` is set. */
function gainDb(db, c) {
  let g = compressorGain(db, c.threshold, c.ratio, c.knee)
  return c.upThreshold == null ? g : g + upwardGain(db, c.upThreshold, c.upRatio, c.upKnee, c.upRange)
}

/** Level in dB per sample: the instantaneous peak |x|, or the RMS of the last \`win\` samples. */
function detector(type = 'peak', win = 256) {
  if (type !== 'rms') return x => lin2db(x)
  let n = Math.max(1, win), buf = new Float64Array(n), sum = 0, i = 0
  return x => {
    let sq = x * x
    sum += sq - buf[i]; buf[i] = sq; i = (i + 1) % n
    return 10 / Math.LN10 * Math.log(Math.max(sum / n, 1e-20))
  }
}

/** Smooth decoupled peak detector, eq. (17), run on gain reduction in dB (> 0 reduces, < 0 lifts):
 *  y₁ = max(x, αR·y₁ + (1 − αR)·x), y = αA·y + (1 − αA)·y₁, α = e^(−1/(τ·fs)), eq. (7). */
function smoother(attack, release, sampleRate) {
  let aA = timeCoef(attack, sampleRate), aR = timeCoef(release, sampleRate), y1 = 0, y = 0
  return x => {
    let r = aR * y1 + (1 - aR) * x
    y1 = x > r ? x : r
    return y = aA * y + (1 - aA) * y1
  }
}

// Soft-knee downward compression curve, eq. (4). Returns gain reduction in dB (≤ 0).
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

return { compress, compressorState };
})();

const compressor = (() => {
const { compress, compressorState } = module17;
// atom manifest — wraps the dynamics compressor kernel per @audio/compile CONTRACT.
// attack/release seed the gain smoother at construction (flags: restart); the rest are live.
// Upward compression (below threshold) sums with downward in the dB domain — see
// compressor.js. The params convention has no null, so upRatio defaults to 1: a
// mathematical no-op (upwardGain ≡ 0 for any threshold/knee/level when ratio is 1),
// which is the off-switch here in place of the kernel's \`upThreshold: null\`.
// No tail: the output is the input times a gain, silent when the input is.

const compressor = (ctx) => {
	const st = []
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) st.push(compressorState(ctx.params.attack[0], ctx.params.release[0], ctx.sampleRate))
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		const curve = {
			threshold: params.threshold[0], ratio: params.ratio[0], knee: params.knee[0],
			upThreshold: params.upThreshold[0], upRatio: params.upRatio[0], upKnee: params.upKnee[0], upRange: params.upRange[0],
		}
		for (let c = 0; c < inp.length; c++) compress(inp[c], out[c], st[c], curve, 1, params.makeup[0])
	}
}
compressor.channels = 'any'
compressor.tail = 0
compressor.params = {
	threshold:   { type: 'number', min: -60, max: 0, default: -20, smoothing: 0.01, unit: 'dB' },
	ratio:       { type: 'number', min: 1, max: 20, default: 4 },
	knee:        { type: 'number', min: 0, max: 24, default: 6, unit: 'dB' },
	makeup:      { type: 'number', min: -12, max: 24, default: 0, unit: 'dB' },
	upThreshold: { type: 'number', min: -80, max: 0, default: -40, smoothing: 0.01, unit: 'dB' },
	upRatio:     { type: 'number', min: 1, max: 20, default: 1 },
	upKnee:      { type: 'number', min: 0, max: 24, default: 6, unit: 'dB' },
	upRange:     { type: 'number', min: 0, max: 40, default: 12, unit: 'dB' },
	attack:      { type: 'number', min: 0.1, max: 100, default: 5, unit: 'ms', flags: ['restart'] },
	release:     { type: 'number', min: 1, max: 1000, default: 100, unit: 'ms', flags: ['restart'] },
}

return compressor;
})();
`;
