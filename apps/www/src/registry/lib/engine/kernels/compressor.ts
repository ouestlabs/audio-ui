/**
 * audio.js kernels, each module as published, in its own scope, for an
 * `AudioWorklet`, which cannot import them:
 * - `@audio/dynamics-envelope` 0.1.4 (MIT, Dmitry Iv.): `timeCoef`, as `module0`
 * - `@audio/dynamics-envelope` 0.1.4 (MIT, Dmitry Iv.): `envelope`, as `module1`
 * - `@audio/dynamics-compressor` 0.2.1 (MIT, Dmitry Iv.): `db2lin`, `lin2db`, `writer`, `concat`, as `module2`
 * - `@audio/dynamics-compressor` 0.2.1 (MIT, Dmitry Iv.): `compressor`, `compressorStream`, `compressorGain`, `upwardGain`, as `module3`
 * - `@audio/dynamics-vca` 0.3.1 (MIT, Dmitry Iv.): `writer`, `concat`, `db2lin`, `lin2db`, `timeCoef`, `keyed`, `link`, `linAt`, `coefAt`, `GLIDE`, `glide`, as `module4`
 * - `@audio/dynamics-vca` 0.3.1 (MIT, Dmitry Iv.): `vca`, `vcaStream`, `vcaBlock`, `vcaLevel`, `vcaGain`, as `module5`
 * - `@audio/dynamics-vca` 0.3.1 (MIT, Dmitry Iv.): `vca`
 * - `@audio/dynamics-fet` 0.3.1 (MIT, Dmitry Iv.): `writer`, `concat`, `db2lin`, `lin2db`, `timeCoef`, `keyed`, `link`, `linAt`, `coefAt`, `GLIDE`, `glide`, as `module7`
 * - `@audio/dynamics-fet` 0.3.1 (MIT, Dmitry Iv.): `fet`, `fetStream`, `fetBlock`, `fetLevel`, `fetGain`, as `module8`
 * - `@audio/dynamics-fet` 0.3.1 (MIT, Dmitry Iv.): `fet`
 * - `@audio/dynamics-opto` 0.3.1 (MIT, Dmitry Iv.): `writer`, `concat`, `db2lin`, `lin2db`, `timeCoef`, `keyed`, `link`, `linAt`, `coefAt`, `GLIDE`, `glide`, as `module10`
 * - `@audio/dynamics-opto` 0.3.1 (MIT, Dmitry Iv.): `opto`, `optoStream`, `optoBlock`, `optoLevel`, `optoGain`, as `module11`
 * - `@audio/dynamics-opto` 0.3.1 (MIT, Dmitry Iv.): `opto`
 * - `@audio/dynamics-varimu` 0.3.1 (MIT, Dmitry Iv.): `writer`, `concat`, `db2lin`, `lin2db`, `timeCoef`, `GLIDE`, `glide`, as `module13`
 * - `@audio/dynamics-varimu` 0.3.1 (MIT, Dmitry Iv.): `varimu`, `varimuStream`, `varimuBlock`, as `module14`
 * - `@audio/dynamics-varimu` 0.3.1 (MIT, Dmitry Iv.): `varimu`
 * - `@audio/dynamics-compressor` 0.4.1 (MIT, Dmitry Iv.): `db2lin`, `lin2db`, `timeCoef`, `writer`, `concat`, `keyed`, `link`, `linAt`, `coefAt`, `GLIDE`, `glide`, as `module16`
 * - `@audio/dynamics-compressor` 0.4.1 (MIT, Dmitry Iv.): `compressor`, `compressorStream`, `compressorState`, `compress`, `compressBlock`, `compressLevel`, `compressGain`, `gainDb`, `detector`, `smoother`, `compressorGain`, `upwardGain`, as `module17`
 * - `@audio/dynamics-compressor` 0.4.1 (MIT, Dmitry Iv.): `compressor`
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

return { db2lin, lin2db, writer, concat };
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

return { compressor, compressorStream, compressorGain, upwardGain, default: compressor };
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

// A key bus that carries channels feeds the detector in place of the input: a mono key serves every channel, and one
// of fewer channels than the input serves them in turn. A key bus that nothing feeds has no channels (contract 1.0:
// Channels, process): each channel then reads itself. "We could instead feed in an arbitrary signal in the side-chain,
// in order to achieve side-chaining operation (e.g., to implement a ducker or a de-esser)" (Giannoulis, Massberg &
// Reiss 2012, §3.1.1).
const keyed = (key, x, c) => key && key.length ? key[c % key.length] : x[c]

// Stereo link, 0 to 1: each channel's level made, in place, link times the loudest channel's plus (1 − link) times its
// own, sample by sample. At 1 every channel reads one level and takes one gain, so linked channels act together when
// one crosses the threshold and the stereo image holds (Jeffs, Holden & Bohn, "Dynamics Processors: Technology &
// Applications", RaneNote 155, 2005, ch. 1). \`lev\`: a Float64Array per channel, \`nc\` channels of \`n\` samples, each the
// level the kernel's gain computer reads (linear); \`at\`: the link in its first slot, the param's own array (a number V8
// passes to a call it does not inline is a new object; Node 20 and 22 did so here as link moved every call).
function link(lev, nc, n, at) {
  let amt = at[0], own = 1 - amt
  for (let i = 0; i < n; i++) {
    let m = lev[0][i]
    for (let c = 1; c < nc; c++) if (lev[c][i] > m) m = lev[c][i]
    for (let c = 0; c < nc; c++) lev[c][i] = amt * m + own * lev[c][i]
  }
}

// dst[i] = db2lin(src[j]), and dst[i] = timeCoef(src[j], sampleRate), their arithmetic written out: the manifests'
// coefficients, with only arrays and indices crossing the call and none made inside it. A number V8 passes to a call it
// does not inline is a new object, and Node 20 and 22 left such calls out of the manifests' process once it read a key
// and linked channels: a block allocated as values moved.
function linAt(dst, i, src, j) { dst[i] = Math.exp(src[j] * (Math.LN10 / 20)) }
function coefAt(dst, i, src, j, sampleRate) { let ms = src[j]; dst[i] = ms <= 0 ? 0 : Math.exp(-1 / (ms * 0.001 * sampleRate)) }

// A value that scales the signal, glided sample by sample so that a host's steps of it join into one line. A host hands
// each call the value at its first frame and, while a value moves (a \`smoothing\` ramp), calls with 32 frames at most
// (contract 1.0: Parameters, Time; What a host owes, 3). So the line through the values the calls bring, each at its
// call's first frame, is known 32 frames behind any call's first frame, however the host cut the calls; the glide plays
// it 32 frames late. Straight from the value of one call to the next's, it is the host's ramp itself, in the value's
// own unit, the same whether the host calls with 1, 32 or a mix of frames; drawn between each call's end and the next
// (a glide across each call), a ramp cut 32, 4, 32 would put 32 frames of it into 4. A value that follows a call of
// more than 32 frames came with no ramp: it is reached in a straight line over 32 frames. The first call of an
// instance starts on its value, and a value held 32 frames is the value itself, so a value that does not move is
// bit for bit what it was before the glide existed.
// \`g\`: the memory, GLIDE slots a value from j·GLIDE (made NaN): the value the last call brought, where in the ring its
// first frame is, its frames, the frames the line had been at that value before it (64 once held and the ring all of
// it; counted to 63 at most, so that a long call after a move cannot reach 64 before the ring is made all of it), how
// many of \`row\`'s hold it, then the line, a frame a slot, in a ring of 64. \`src\`: the param's array. The
// line's values for this call's \`n\` frames go to \`row\` from \`at\`: as they are, or with \`lin\` 1 the gain e^(v·ln10/20)
// of a value in dB, per sample, so the gain follows the host's ramp of the dB value. Returns 1 while they move, 0 when
// every one is the value (then \`row\` holds it, filled once, and a caller may run its kernel on the value alone). Only
// arrays and whole numbers cross the call.
const GLIDE = 69
function glide(g, j, src, row, at, n, lin) {
  let o = j * GLIDE, r = o + 5, v = src[0], was = g[o]
  if (!(was === was)) { g[o] = v; g[o + 1] = 0; g[o + 2] = n; g[o + 3] = 0; g[o + 4] = 0 }
  else if (v !== was || g[o + 3] < 64) {
    let len = g[o + 2], L = len < 32 ? len : 32, w = (g[o + 1] + len) & 63, d = v - was, held = v === was ? Math.min(g[o + 3] + len, 63) : 0
    for (let q = 0; q < L; q++) g[r + ((w - L + q) & 63)] = was + d * q / L
    g[r + w] = v
    g[o] = v; g[o + 1] = w; g[o + 2] = n; g[o + 3] = held; g[o + 4] = 0
    if (held < 32) {
      for (let i = 0; i < n; i++) {
        let u = i < 32 ? g[r + ((w + i - 32) & 63)] : v
        row[at + i] = lin ? Math.exp(u * (Math.LN10 / 20)) : u
      }
      return 1
    }
  } else { g[o + 1] = (g[o + 1] + g[o + 2]) & 63; g[o + 2] = n }
  // held 32 frames: the ring made all of the value once (a move from it reads the line from there), the row filled
  // with it as far as no call since it was held has filled it; from then on a call only moves the ring's position
  if (g[o + 3] < 64) { for (let q = 0; q < 64; q++) g[r + q] = v; g[o + 3] = 64 }
  if (g[o + 4] < n) {
    let u = lin ? Math.exp(v * (Math.LN10 / 20)) : v
    for (let i = 0; i < n; i++) row[at + i] = u
    g[o + 4] = n
  }
  return 0
}

return { writer, concat, db2lin, lin2db, timeCoef, keyed, link, linAt, coefAt, GLIDE, glide };
})();

const module5 = (() => {
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
	let aCoef = timeCoef(opts.attack ?? 1, sr)
	// the peak follower attacks with the gain and releases in 1 ms
	let k = Float64Array.of(opts.threshold ?? -20, opts.ratio ?? 4, opts.knee ?? 1, opts.makeup ?? 0, aCoef, timeCoef(opts.release ?? 150, sr), aCoef, timeCoef(1, sr))
	let s = new Float64Array(2)

	return {
		write (chunk) { return vcaBlock(chunk, new Float32Array(chunk.length), s, k) },
		flush () { return new Float32Array(0) }
	}
}

/** One block of one channel into \`out\` (which may be \`x\`), allocating nothing. \`s\`, the state: Float64Array(2), the
 *  peak follower and the gain reduction in dB. \`k\`, the settings: Float64Array(8), threshold, ratio, knee and makeup
 *  (dB), the gain's attack and release coefficients, the follower's attack and release coefficients. Its two halves,
 *  vcaLevel and vcaGain, let a level come from elsewhere between them (a key, the loudest of linked channels). */
function vcaBlock (x, out, s, k) {
	if (LEV.length < x.length) LEV = new Float64Array(x.length)
	vcaLevel(x, LEV, s, k)
	return vcaGain(x, LEV, out, s, k)
}
let LEV = new Float64Array(0)

/** vcaBlock's follower: its level after each sample of \`x\` into \`lev\` (Float64Array, as long or longer), linear. */
function vcaLevel (x, lev, s, k) {
	let aE = k[6], rE = k[7], env = s[0]
	for (let i = 0; i < x.length; i++) {
		let v = x[i], mag = v < 0 ? -v : v, c = mag > env ? aE : rE
		env = c * env + (1 - c) * mag
		lev[i] = env
	}
	s[0] = env
}

/** vcaBlock's gain: \`x\` into \`out\` (which may be \`x\`), each sample by the gain reduction its level in \`lev\` (as
 *  vcaLevel gives it) calls for, smoothed. \`mk\`: the makeup (dB) for each sample (Float64Array, as long or longer), as a
 *  host's ramp moves it; empty (the default), \`k\`'s. */
function vcaGain (x, lev, out, s, k, mk = NONE) {
	let T = k[0], R = k[1], W = k[2], m = k[3], aC = k[4], rC = k[5], gr = s[1], ramp = mk.length > 0
	for (let i = 0; i < x.length; i++) {
		let target = compressorGain(lin2db(lev[i]), T, R, W)
		gr = target < gr ? target + (gr - target) * aC : target + (gr - target) * rC
		out[i] = x[i] * db2lin(gr + (ramp ? mk[i] : m))
	}
	s[1] = gr
	return out
}
const NONE = new Float64Array(0)

return { vca, vcaStream, vcaBlock, vcaLevel, vcaGain, default: vca };
})();

const vca = (() => {
const { vcaLevel, vcaGain } = module5;
const { timeCoef, keyed, link, coefAt, glide, GLIDE } = module4;
// atom manifest — VCA compressor (dbx/SSL-bus class: clean feed-forward peak
// detection, near-hard knee, dB-linear gain). Every param is live: read each block,
// the attack and release coefficients recomputed when their value changes, the
// follower and the gain reduction kept, so a change is heard from the next sample
// with no jump in the gain. State and settings are typed arrays made here; a block
// allocates nothing. No tail: the output is the input times a gain, silent when the
// input is.
// Input bus 1 is the key (fed by the \`key\` option): when it carries channels the
// follower reads them in place of the input (util.js keyed). \`link\` mixes each channel's
// level toward the loudest channel's (util.js link): every channel's level is read
// before any channel's gain, into rows made here by ctx.maxBlockSize. At link 0 and no
// key the kernel runs as vcaBlock does, sample for sample.
// threshold, ratio and knee reach the output through the gain reduction's attack and
// release. makeup scales the output with nothing behind it, so it is smoothed (20 ms)
// and glided sample by sample (util.js glide): a host's ramp of it is one line of the
// gain, however the host cut its calls. Held, it is k's, and the kernel runs as it ran.

const vca = (ctx) => {
	const sr = ctx.sampleRate, st = [], lev = [], k = new Float64Array(8), at = new Float64Array(2).fill(NaN)
	const g = new Float64Array(GLIDE).fill(NaN), mk = new Float64Array(ctx.maxBlockSize)
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) { st.push(new Float64Array(2)); lev.push(new Float64Array(ctx.maxBlockSize)) }
	k[7] = timeCoef(1, sr)
	return (inputs, outputs, params) => {
		const inp = inputs[0], key = inputs[1], out = outputs[0]
		if (!inp || !inp.length) return
		const a = params.attack[0], r = params.release[0], ln = params.link[0], nc = inp.length, n = inp[0].length
		k[0] = params.threshold[0]; k[1] = params.ratio[0]; k[2] = params.knee[0]; k[3] = params.makeup[0]
		if (a !== at[0]) { at[0] = a; coefAt(k, 4, at, 0, sr); k[6] = k[4] }
		if (r !== at[1]) { at[1] = r; coefAt(k, 5, at, 1, sr) }
		const ramp = glide(g, 0, params.makeup, mk, 0, n, 0) ? mk : undefined
		for (let c = 0; c < nc; c++) vcaLevel(keyed(key, inp, c), lev[c], st[c], k)
		if (ln > 0 && nc > 1) link(lev, nc, n, params.link)
		for (let c = 0; c < nc; c++) vcaGain(inp[c], lev[c], out[c], st[c], k, ramp)
	}
}
vca.channels = { inputs: [{ channels: 'any' }, { channels: 'any', name: 'key' }], outputs: 'any' }
vca.tail = 0
vca.params = {
	threshold: { type: 'number', min: -60, max: 0, default: -20, unit: 'dB' },
	ratio:     { type: 'number', min: 1, max: 20, default: 4 },
	knee:      { type: 'number', min: 0, max: 12, default: 1, unit: 'dB' },
	attack:    { type: 'number', min: 0.1, max: 100, default: 1, unit: 'ms' },
	release:   { type: 'number', min: 20, max: 2000, default: 150, unit: 'ms' },
	makeup:    { type: 'number', min: -12, max: 24, default: 0, unit: 'dB', smoothing: 0.02 },
	link:      { type: 'number', min: 0, max: 1, default: 0, smoothing: 0.01 },
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

// A key bus that carries channels feeds the detector in place of the input: a mono key serves every channel, and one
// of fewer channels than the input serves them in turn. A key bus that nothing feeds has no channels (contract 1.0:
// Channels, process): each channel then reads itself. "We could instead feed in an arbitrary signal in the side-chain,
// in order to achieve side-chaining operation (e.g., to implement a ducker or a de-esser)" (Giannoulis, Massberg &
// Reiss 2012, §3.1.1).
const keyed = (key, x, c) => key && key.length ? key[c % key.length] : x[c]

// Stereo link, 0 to 1: each channel's level made, in place, link times the loudest channel's plus (1 − link) times its
// own, sample by sample. At 1 every channel reads one level and takes one gain, so linked channels act together when
// one crosses the threshold and the stereo image holds (Jeffs, Holden & Bohn, "Dynamics Processors: Technology &
// Applications", RaneNote 155, 2005, ch. 1). \`lev\`: a Float64Array per channel, \`nc\` channels of \`n\` samples, each the
// level the kernel's gain computer reads (linear); \`at\`: the link in its first slot, the param's own array (a number V8
// passes to a call it does not inline is a new object; Node 20 and 22 did so here as link moved every call).
function link(lev, nc, n, at) {
  let amt = at[0], own = 1 - amt
  for (let i = 0; i < n; i++) {
    let m = lev[0][i]
    for (let c = 1; c < nc; c++) if (lev[c][i] > m) m = lev[c][i]
    for (let c = 0; c < nc; c++) lev[c][i] = amt * m + own * lev[c][i]
  }
}

// dst[i] = db2lin(src[j]), and dst[i] = timeCoef(src[j], sampleRate), their arithmetic written out: the manifests'
// coefficients, with only arrays and indices crossing the call and none made inside it. A number V8 passes to a call it
// does not inline is a new object, and Node 20 and 22 left such calls out of the manifests' process once it read a key
// and linked channels: a block allocated as values moved.
function linAt(dst, i, src, j) { dst[i] = Math.exp(src[j] * (Math.LN10 / 20)) }
function coefAt(dst, i, src, j, sampleRate) { let ms = src[j]; dst[i] = ms <= 0 ? 0 : Math.exp(-1 / (ms * 0.001 * sampleRate)) }

// A value that scales the signal, glided sample by sample so that a host's steps of it join into one line. A host hands
// each call the value at its first frame and, while a value moves (a \`smoothing\` ramp), calls with 32 frames at most
// (contract 1.0: Parameters, Time; What a host owes, 3). So the line through the values the calls bring, each at its
// call's first frame, is known 32 frames behind any call's first frame, however the host cut the calls; the glide plays
// it 32 frames late. Straight from the value of one call to the next's, it is the host's ramp itself, in the value's
// own unit, the same whether the host calls with 1, 32 or a mix of frames; drawn between each call's end and the next
// (a glide across each call), a ramp cut 32, 4, 32 would put 32 frames of it into 4. A value that follows a call of
// more than 32 frames came with no ramp: it is reached in a straight line over 32 frames. The first call of an
// instance starts on its value, and a value held 32 frames is the value itself, so a value that does not move is
// bit for bit what it was before the glide existed.
// \`g\`: the memory, GLIDE slots a value from j·GLIDE (made NaN): the value the last call brought, where in the ring its
// first frame is, its frames, the frames the line had been at that value before it (64 once held and the ring all of
// it; counted to 63 at most, so that a long call after a move cannot reach 64 before the ring is made all of it), how
// many of \`row\`'s hold it, then the line, a frame a slot, in a ring of 64. \`src\`: the param's array. The
// line's values for this call's \`n\` frames go to \`row\` from \`at\`: as they are, or with \`lin\` 1 the gain e^(v·ln10/20)
// of a value in dB, per sample, so the gain follows the host's ramp of the dB value. Returns 1 while they move, 0 when
// every one is the value (then \`row\` holds it, filled once, and a caller may run its kernel on the value alone). Only
// arrays and whole numbers cross the call.
const GLIDE = 69
function glide(g, j, src, row, at, n, lin) {
  let o = j * GLIDE, r = o + 5, v = src[0], was = g[o]
  if (!(was === was)) { g[o] = v; g[o + 1] = 0; g[o + 2] = n; g[o + 3] = 0; g[o + 4] = 0 }
  else if (v !== was || g[o + 3] < 64) {
    let len = g[o + 2], L = len < 32 ? len : 32, w = (g[o + 1] + len) & 63, d = v - was, held = v === was ? Math.min(g[o + 3] + len, 63) : 0
    for (let q = 0; q < L; q++) g[r + ((w - L + q) & 63)] = was + d * q / L
    g[r + w] = v
    g[o] = v; g[o + 1] = w; g[o + 2] = n; g[o + 3] = held; g[o + 4] = 0
    if (held < 32) {
      for (let i = 0; i < n; i++) {
        let u = i < 32 ? g[r + ((w + i - 32) & 63)] : v
        row[at + i] = lin ? Math.exp(u * (Math.LN10 / 20)) : u
      }
      return 1
    }
  } else { g[o + 1] = (g[o + 1] + g[o + 2]) & 63; g[o + 2] = n }
  // held 32 frames: the ring made all of the value once (a move from it reads the line from there), the row filled
  // with it as far as no call since it was held has filled it; from then on a call only moves the ring's position
  if (g[o + 3] < 64) { for (let q = 0; q < 64; q++) g[r + q] = v; g[o + 3] = 64 }
  if (g[o + 4] < n) {
    let u = lin ? Math.exp(v * (Math.LN10 / 20)) : v
    for (let i = 0; i < n; i++) row[at + i] = u
    g[o + 4] = n
  }
  return 0
}

return { writer, concat, db2lin, lin2db, timeCoef, keyed, link, linAt, coefAt, GLIDE, glide };
})();

const module8 = (() => {
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
	let aCoef = timeCoef(opts.attack ?? 0.2, sr)
	// the peak follower attacks with the gain and releases in 1 ms
	let k = Float64Array.of(opts.threshold ?? -18, opts.ratio ?? 8, opts.knee ?? 3, opts.makeup ?? 0, aCoef, timeCoef(opts.release ?? 120, sr), aCoef, timeCoef(1, sr))
	let s = new Float64Array(2)

	return {
		write (chunk) { return fetBlock(chunk, new Float32Array(chunk.length), s, k) },
		flush () { return new Float32Array(0) }
	}
}

/** One block of one channel into \`out\` (which may be \`x\`), allocating nothing. \`s\`, the state: Float64Array(2), the
 *  peak follower and the gain reduction in dB. \`k\`, the settings: Float64Array(8), threshold, ratio, knee and makeup
 *  (dB), the gain's attack and release coefficients, the follower's attack and release coefficients. Its two halves,
 *  fetLevel and fetGain, let a level come from elsewhere between them (a key, the loudest of linked channels). */
function fetBlock (x, out, s, k) {
	if (LEV.length < x.length) LEV = new Float64Array(x.length)
	fetLevel(x, LEV, s, k)
	return fetGain(x, LEV, out, s, k)
}
let LEV = new Float64Array(0)

/** fetBlock's follower: its level after each sample of \`x\` into \`lev\` (Float64Array, as long or longer), linear. */
function fetLevel (x, lev, s, k) {
	let aE = k[6], rE = k[7], env = s[0]
	for (let i = 0; i < x.length; i++) {
		let v = x[i], mag = v < 0 ? -v : v, c = mag > env ? aE : rE
		env = c * env + (1 - c) * mag
		lev[i] = env
	}
	s[0] = env
}

/** fetBlock's gain: \`x\` into \`out\` (which may be \`x\`), each sample by the gain reduction its level in \`lev\` (as
 *  fetLevel gives it) calls for, smoothed. \`mk\`: the makeup (dB) for each sample (Float64Array, as long or longer), as a
 *  host's ramp moves it; empty (the default), \`k\`'s. */
function fetGain (x, lev, out, s, k, mk = NONE) {
	let T = k[0], R = k[1], W = k[2], m = k[3], aC = k[4], rC = k[5], gr = s[1], ramp = mk.length > 0
	for (let i = 0; i < x.length; i++) {
		let target = compressorGain(lin2db(lev[i]), T, R, W)
		gr = target < gr ? target + (gr - target) * aC : target + (gr - target) * rC
		out[i] = x[i] * db2lin(gr + (ramp ? mk[i] : m))
	}
	s[1] = gr
	return out
}
const NONE = new Float64Array(0)

return { fet, fetStream, fetBlock, fetLevel, fetGain, default: fet };
})();

const fet = (() => {
const { fetLevel, fetGain } = module8;
const { timeCoef, keyed, link, coefAt, glide, GLIDE } = module7;
// atom manifest — FET compressor (1176 class: very fast peak detection, high ratios,
// firm knee). Every param is live: read each block, the attack and release coefficients
// recomputed when their value changes, the follower and the gain reduction kept, so a
// change is heard from the next sample with no jump in the gain. State and settings are
// typed arrays made here; a block allocates nothing. No tail: the output is the input
// times a gain, silent when the input is.
// Input bus 1 is the key (fed by the \`key\` option): when it carries channels the
// follower reads them in place of the input (util.js keyed). \`link\` mixes each channel's
// level toward the loudest channel's (util.js link): every channel's level is read
// before any channel's gain, into rows made here by ctx.maxBlockSize. At link 0 and no
// key the kernel runs as fetBlock does, sample for sample.
// threshold, ratio and knee reach the output through the gain reduction's attack and
// release. makeup scales the output with nothing behind it, so it is smoothed (20 ms)
// and glided sample by sample (util.js glide): a host's ramp of it is one line of the
// gain, however the host cut its calls. Held, it is k's, and the kernel runs as it ran.

const fet = (ctx) => {
	const sr = ctx.sampleRate, st = [], lev = [], k = new Float64Array(8), at = new Float64Array(2).fill(NaN)
	const g = new Float64Array(GLIDE).fill(NaN), mk = new Float64Array(ctx.maxBlockSize)
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) { st.push(new Float64Array(2)); lev.push(new Float64Array(ctx.maxBlockSize)) }
	k[7] = timeCoef(1, sr)
	return (inputs, outputs, params) => {
		const inp = inputs[0], key = inputs[1], out = outputs[0]
		if (!inp || !inp.length) return
		const a = params.attack[0], r = params.release[0], ln = params.link[0], nc = inp.length, n = inp[0].length
		k[0] = params.threshold[0]; k[1] = params.ratio[0]; k[2] = params.knee[0]; k[3] = params.makeup[0]
		if (a !== at[0]) { at[0] = a; coefAt(k, 4, at, 0, sr); k[6] = k[4] }
		if (r !== at[1]) { at[1] = r; coefAt(k, 5, at, 1, sr) }
		const ramp = glide(g, 0, params.makeup, mk, 0, n, 0) ? mk : undefined
		for (let c = 0; c < nc; c++) fetLevel(keyed(key, inp, c), lev[c], st[c], k)
		if (ln > 0 && nc > 1) link(lev, nc, n, params.link)
		for (let c = 0; c < nc; c++) fetGain(inp[c], lev[c], out[c], st[c], k, ramp)
	}
}
fet.channels = { inputs: [{ channels: 'any' }, { channels: 'any', name: 'key' }], outputs: 'any' }
fet.tail = 0
fet.params = {
	threshold: { type: 'number', min: -60, max: 0, default: -18, unit: 'dB' },
	ratio:     { type: 'number', min: 4, max: 20, default: 8 },
	knee:      { type: 'number', min: 0, max: 12, default: 3, unit: 'dB' },
	attack:    { type: 'number', min: 0.02, max: 5, default: 0.2, unit: 'ms' },
	release:   { type: 'number', min: 20, max: 1000, default: 120, unit: 'ms' },
	makeup:    { type: 'number', min: -12, max: 24, default: 0, unit: 'dB', smoothing: 0.02 },
	link:      { type: 'number', min: 0, max: 1, default: 0, smoothing: 0.01 },
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

// A key bus that carries channels feeds the detector in place of the input: a mono key serves every channel, and one
// of fewer channels than the input serves them in turn. A key bus that nothing feeds has no channels (contract 1.0:
// Channels, process): each channel then reads itself. "We could instead feed in an arbitrary signal in the side-chain,
// in order to achieve side-chaining operation (e.g., to implement a ducker or a de-esser)" (Giannoulis, Massberg &
// Reiss 2012, §3.1.1).
const keyed = (key, x, c) => key && key.length ? key[c % key.length] : x[c]

// Stereo link, 0 to 1: each channel's level made, in place, link times the loudest channel's plus (1 − link) times its
// own, sample by sample. At 1 every channel reads one level and takes one gain, so linked channels act together when
// one crosses the threshold and the stereo image holds (Jeffs, Holden & Bohn, "Dynamics Processors: Technology &
// Applications", RaneNote 155, 2005, ch. 1). \`lev\`: a Float64Array per channel, \`nc\` channels of \`n\` samples, each the
// level the kernel's gain computer reads (linear); \`at\`: the link in its first slot, the param's own array (a number V8
// passes to a call it does not inline is a new object; Node 20 and 22 did so here as link moved every call).
function link(lev, nc, n, at) {
  let amt = at[0], own = 1 - amt
  for (let i = 0; i < n; i++) {
    let m = lev[0][i]
    for (let c = 1; c < nc; c++) if (lev[c][i] > m) m = lev[c][i]
    for (let c = 0; c < nc; c++) lev[c][i] = amt * m + own * lev[c][i]
  }
}

// dst[i] = db2lin(src[j]), and dst[i] = timeCoef(src[j], sampleRate), their arithmetic written out: the manifests'
// coefficients, with only arrays and indices crossing the call and none made inside it. A number V8 passes to a call it
// does not inline is a new object, and Node 20 and 22 left such calls out of the manifests' process once it read a key
// and linked channels: a block allocated as values moved.
function linAt(dst, i, src, j) { dst[i] = Math.exp(src[j] * (Math.LN10 / 20)) }
function coefAt(dst, i, src, j, sampleRate) { let ms = src[j]; dst[i] = ms <= 0 ? 0 : Math.exp(-1 / (ms * 0.001 * sampleRate)) }

// A value that scales the signal, glided sample by sample so that a host's steps of it join into one line. A host hands
// each call the value at its first frame and, while a value moves (a \`smoothing\` ramp), calls with 32 frames at most
// (contract 1.0: Parameters, Time; What a host owes, 3). So the line through the values the calls bring, each at its
// call's first frame, is known 32 frames behind any call's first frame, however the host cut the calls; the glide plays
// it 32 frames late. Straight from the value of one call to the next's, it is the host's ramp itself, in the value's
// own unit, the same whether the host calls with 1, 32 or a mix of frames; drawn between each call's end and the next
// (a glide across each call), a ramp cut 32, 4, 32 would put 32 frames of it into 4. A value that follows a call of
// more than 32 frames came with no ramp: it is reached in a straight line over 32 frames. The first call of an
// instance starts on its value, and a value held 32 frames is the value itself, so a value that does not move is
// bit for bit what it was before the glide existed.
// \`g\`: the memory, GLIDE slots a value from j·GLIDE (made NaN): the value the last call brought, where in the ring its
// first frame is, its frames, the frames the line had been at that value before it (64 once held and the ring all of
// it; counted to 63 at most, so that a long call after a move cannot reach 64 before the ring is made all of it), how
// many of \`row\`'s hold it, then the line, a frame a slot, in a ring of 64. \`src\`: the param's array. The
// line's values for this call's \`n\` frames go to \`row\` from \`at\`: as they are, or with \`lin\` 1 the gain e^(v·ln10/20)
// of a value in dB, per sample, so the gain follows the host's ramp of the dB value. Returns 1 while they move, 0 when
// every one is the value (then \`row\` holds it, filled once, and a caller may run its kernel on the value alone). Only
// arrays and whole numbers cross the call.
const GLIDE = 69
function glide(g, j, src, row, at, n, lin) {
  let o = j * GLIDE, r = o + 5, v = src[0], was = g[o]
  if (!(was === was)) { g[o] = v; g[o + 1] = 0; g[o + 2] = n; g[o + 3] = 0; g[o + 4] = 0 }
  else if (v !== was || g[o + 3] < 64) {
    let len = g[o + 2], L = len < 32 ? len : 32, w = (g[o + 1] + len) & 63, d = v - was, held = v === was ? Math.min(g[o + 3] + len, 63) : 0
    for (let q = 0; q < L; q++) g[r + ((w - L + q) & 63)] = was + d * q / L
    g[r + w] = v
    g[o] = v; g[o + 1] = w; g[o + 2] = n; g[o + 3] = held; g[o + 4] = 0
    if (held < 32) {
      for (let i = 0; i < n; i++) {
        let u = i < 32 ? g[r + ((w + i - 32) & 63)] : v
        row[at + i] = lin ? Math.exp(u * (Math.LN10 / 20)) : u
      }
      return 1
    }
  } else { g[o + 1] = (g[o + 1] + g[o + 2]) & 63; g[o + 2] = n }
  // held 32 frames: the ring made all of the value once (a move from it reads the line from there), the row filled
  // with it as far as no call since it was held has filled it; from then on a call only moves the ring's position
  if (g[o + 3] < 64) { for (let q = 0; q < 64; q++) g[r + q] = v; g[o + 3] = 64 }
  if (g[o + 4] < n) {
    let u = lin ? Math.exp(v * (Math.LN10 / 20)) : v
    for (let i = 0; i < n; i++) row[at + i] = u
    g[o + 4] = n
  }
  return 0
}

return { writer, concat, db2lin, lin2db, timeCoef, keyed, link, linAt, coefAt, GLIDE, glide };
})();

const module11 = (() => {
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
	let aCoef = timeCoef(opts.attack ?? 10, sr)
	// the RMS follower attacks with the gain and releases in 1 ms; the T4 memory integrates ~3 s of history
	let k = Float64Array.of(opts.threshold ?? -20, opts.ratio ?? 3, opts.knee ?? 10, opts.makeup ?? 0, aCoef, timeCoef(1, sr), timeCoef(3000, sr), opts.release ?? 300, sr)
	let s = new Float64Array(5), ring = new Float32Array(Math.max(1, opts.rmsWindow || 256))

	return {
		write (chunk) { return optoBlock(chunk, new Float32Array(chunk.length), s, ring, k) },
		flush () { return new Float32Array(0) }
	}
}

/** One block of one channel into \`out\` (which may be \`x\`), allocating nothing. \`s\`, the state: Float64Array(5), the
 *  RMS follower, the gain reduction in dB, the T4 memory, the window's sum and position; \`ring\`, the window's squares
 *  (Float32Array of its length). \`k\`, the settings: Float64Array(9), threshold, ratio, knee and makeup (dB), the
 *  attack coefficient (gain and follower), the follower's release coefficient, the memory's coefficient, the nominal
 *  release (ms, stretched up to 7× by the memory), the sample rate. */
function optoBlock (x, out, s, ring, k) {
	if (LEV.length < x.length) LEV = new Float64Array(x.length)
	optoLevel(x, LEV, s, ring, k)
	return optoGain(x, LEV, out, s, k)
}
let LEV = new Float64Array(0)

/** optoBlock's RMS follower: its level after each sample of \`x\` into \`lev\` (Float64Array, as long or longer), linear.
 *  optoLevel then optoGain is optoBlock, with room between them for a level from elsewhere (a key, the loudest of
 *  linked channels). */
function optoLevel (x, lev, s, ring, k) {
	let aC = k[4], rE = k[5], n = ring.length
	let env = s[0], sum = s[3], j = s[4] | 0
	for (let i = 0; i < x.length; i++) {
		let v = x[i], sq = v * v
		sum += sq - ring[j]; ring[j] = sq; j = (j + 1) % n
		let mag = Math.sqrt(Math.max(0, sum / n)), c = mag > env ? aC : rE
		env = c * env + (1 - c) * mag
		lev[i] = env
	}
	s[0] = env; s[3] = sum; s[4] = j
}

/** optoBlock's gain: \`x\` into \`out\` (which may be \`x\`), each sample by the gain reduction its level in \`lev\` (as
 *  optoLevel gives it) calls for, smoothed, its release stretched by the T4 memory. \`mk\`: the makeup (dB) for each
 *  sample (Float64Array, as long or longer), as a host's ramp moves it; empty (the default), \`k\`'s. */
function optoGain (x, lev, out, s, k, mk = NONE) {
	let T = k[0], R = k[1], W = k[2], m = k[3], aC = k[4], mC = k[6], rel = k[7], sr = k[8], ramp = mk.length > 0
	let gr = s[1], memory = s[2]
	for (let i = 0; i < x.length; i++) {
		let target = compressorGain(lin2db(lev[i]), T, R, W)
		memory = memory * mC + (target < -1 ? 1 - mC : 0)
		let rCoef = timeCoef(rel * (1 + 6 * memory), sr)
		gr = target < gr ? target + (gr - target) * aC : target + (gr - target) * rCoef
		out[i] = x[i] * db2lin(gr + (ramp ? mk[i] : m))
	}
	s[1] = gr; s[2] = memory
	return out
}
const NONE = new Float64Array(0)

return { opto, optoStream, optoBlock, optoLevel, optoGain, default: opto };
})();

const opto = (() => {
const { optoLevel, optoGain } = module11;
const { timeCoef, keyed, link, coefAt, glide, GLIDE } = module10;
// atom manifest — optical compressor (LA-2A class: RMS detection, wide soft knee,
// ~3:1, T4 program-dependent release that slows the longer reduction persists).
// Every param is live: read each block, the attack coefficient recomputed when its
// value changes, the follower, the gain reduction and the T4 memory kept, so a change
// is heard from the next sample with no jump in the gain. State and settings are typed
// arrays made here; a block allocates nothing. No tail: the output is the input times
// a gain, silent when the input is (the memory only slows the release of that gain).
// Input bus 1 is the key (fed by the \`key\` option): when it carries channels the
// follower reads them in place of the input (util.js keyed). \`link\` mixes each channel's
// level toward the loudest channel's (util.js link): every channel's level is read
// before any channel's gain, into rows made here by ctx.maxBlockSize. At link 0 and no
// key the kernel runs as optoBlock does, sample for sample.
// threshold, ratio and knee reach the output through the gain reduction's attack and
// release. makeup scales the output with nothing behind it, so it is smoothed (20 ms)
// and glided sample by sample (util.js glide): a host's ramp of it is one line of the
// gain, however the host cut its calls. Held, it is k's, and the kernel runs as it ran.

const opto = (ctx) => {
	const sr = ctx.sampleRate, st = [], rings = [], lev = [], k = new Float64Array(9), at = new Float64Array(1).fill(NaN)
	const g = new Float64Array(GLIDE).fill(NaN), mk = new Float64Array(ctx.maxBlockSize)
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) { st.push(new Float64Array(5)); rings.push(new Float32Array(256)); lev.push(new Float64Array(ctx.maxBlockSize)) }
	k[5] = timeCoef(1, sr); k[6] = timeCoef(3000, sr); k[7] = 300; k[8] = sr
	return (inputs, outputs, params) => {
		const inp = inputs[0], key = inputs[1], out = outputs[0]
		if (!inp || !inp.length) return
		const a = params.attack[0], ln = params.link[0], nc = inp.length, n = inp[0].length
		k[0] = params.threshold[0]; k[1] = params.ratio[0]; k[2] = params.knee[0]; k[3] = params.makeup[0]
		if (a !== at[0]) { at[0] = a; coefAt(k, 4, at, 0, sr) }
		const ramp = glide(g, 0, params.makeup, mk, 0, n, 0) ? mk : undefined
		for (let c = 0; c < nc; c++) optoLevel(keyed(key, inp, c), lev[c], st[c], rings[c], k)
		if (ln > 0 && nc > 1) link(lev, nc, n, params.link)
		for (let c = 0; c < nc; c++) optoGain(inp[c], lev[c], out[c], st[c], k, ramp)
	}
}
opto.channels = { inputs: [{ channels: 'any' }, { channels: 'any', name: 'key' }], outputs: 'any' }
opto.tail = 0
opto.params = {
	threshold: { type: 'number', min: -60, max: 0, default: -20, unit: 'dB' },
	ratio:     { type: 'number', min: 1.5, max: 6, default: 3 },
	knee:      { type: 'number', min: 4, max: 24, default: 10, unit: 'dB' },
	attack:    { type: 'number', min: 1, max: 100, default: 10, unit: 'ms' },
	makeup:    { type: 'number', min: -12, max: 24, default: 0, unit: 'dB', smoothing: 0.02 },
	link:      { type: 'number', min: 0, max: 1, default: 0, smoothing: 0.01 },
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

// A value that scales the signal, glided sample by sample so that a host's steps of it join into one line. A host hands
// each call the value at its first frame and, while a value moves (a \`smoothing\` ramp), calls with 32 frames at most
// (contract 1.0: Parameters, Time; What a host owes, 3). So the line through the values the calls bring, each at its
// call's first frame, is known 32 frames behind any call's first frame, however the host cut the calls; the glide plays
// it 32 frames late. Straight from the value of one call to the next's, it is the host's ramp itself, in the value's
// own unit, the same whether the host calls with 1, 32 or a mix of frames; drawn between each call's end and the next
// (a glide across each call), a ramp cut 32, 4, 32 would put 32 frames of it into 4. A value that follows a call of
// more than 32 frames came with no ramp: it is reached in a straight line over 32 frames. The first call of an
// instance starts on its value, and a value held 32 frames is the value itself, so a value that does not move is
// bit for bit what it was before the glide existed.
// \`g\`: the memory, GLIDE slots a value from j·GLIDE (made NaN): the value the last call brought, where in the ring its
// first frame is, its frames, the frames the line had been at that value before it (64 once held and the ring all of
// it; counted to 63 at most, so that a long call after a move cannot reach 64 before the ring is made all of it), how
// many of \`row\`'s hold it, then the line, a frame a slot, in a ring of 64. \`src\`: the param's array. The
// line's values for this call's \`n\` frames go to \`row\` from \`at\`: as they are, or with \`lin\` 1 the gain e^(v·ln10/20)
// of a value in dB, per sample, so the gain follows the host's ramp of the dB value. Returns 1 while they move, 0 when
// every one is the value (then \`row\` holds it, filled once, and a caller may run its kernel on the value alone). Only
// arrays and whole numbers cross the call.
const GLIDE = 69
function glide(g, j, src, row, at, n, lin) {
  let o = j * GLIDE, r = o + 5, v = src[0], was = g[o]
  if (!(was === was)) { g[o] = v; g[o + 1] = 0; g[o + 2] = n; g[o + 3] = 0; g[o + 4] = 0 }
  else if (v !== was || g[o + 3] < 64) {
    let len = g[o + 2], L = len < 32 ? len : 32, w = (g[o + 1] + len) & 63, d = v - was, held = v === was ? Math.min(g[o + 3] + len, 63) : 0
    for (let q = 0; q < L; q++) g[r + ((w - L + q) & 63)] = was + d * q / L
    g[r + w] = v
    g[o] = v; g[o + 1] = w; g[o + 2] = n; g[o + 3] = held; g[o + 4] = 0
    if (held < 32) {
      for (let i = 0; i < n; i++) {
        let u = i < 32 ? g[r + ((w + i - 32) & 63)] : v
        row[at + i] = lin ? Math.exp(u * (Math.LN10 / 20)) : u
      }
      return 1
    }
  } else { g[o + 1] = (g[o + 1] + g[o + 2]) & 63; g[o + 2] = n }
  // held 32 frames: the ring made all of the value once (a move from it reads the line from there), the row filled
  // with it as far as no call since it was held has filled it; from then on a call only moves the ring's position
  if (g[o + 3] < 64) { for (let q = 0; q < 64; q++) g[r + q] = v; g[o + 3] = 64 }
  if (g[o + 4] < n) {
    let u = lin ? Math.exp(v * (Math.LN10 / 20)) : v
    for (let i = 0; i < n; i++) row[at + i] = u
    g[o + 4] = n
  }
  return 0
}

return { writer, concat, db2lin, lin2db, timeCoef, GLIDE, glide };
})();

const module14 = (() => {
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
	// the RMS follower attacks with the gain and releases in 1 ms
	let k = Float64Array.of(opts.threshold ?? -22, opts.knee ?? 15, opts.makeup ?? 0, timeCoef(opts.attack ?? 25, sr), timeCoef(opts.release ?? 400, sr), timeCoef(1, sr))
	let s = new Float64Array(4), ring = new Float32Array(Math.max(1, opts.rmsWindow || 256))

	return {
		write (chunk) { return varimuBlock(chunk, new Float32Array(chunk.length), s, ring, k) },
		flush () { return new Float32Array(0) }
	}
}

/** One block of one channel into \`out\` (which may be \`x\`), allocating nothing. \`s\`, the state: Float64Array(4), the
 *  RMS follower, the gain reduction in dB, the window's sum and position; \`ring\`, the window's squares (Float32Array of
 *  its length). \`k\`, the settings: Float64Array(6), threshold, knee and makeup (dB), the attack coefficient (gain and
 *  follower), the gain's release coefficient, the follower's release coefficient. The follower reads the output (the
 *  feedback) and is stepped twice a sample, once for the drive and once for the gain, so its attack acts in half the
 *  set time and its window spans half as many samples. \`mk\`: the makeup (dB) for each sample (Float64Array, as long or
 *  longer), as a host's ramp moves it; empty (the default), \`k\`'s. The follower reads the output before makeup. */
function varimuBlock (x, out, s, ring, k, mk = NONE) {
	let T = k[0], W = k[1], m = k[2], aC = k[3], rC = k[4], rE = k[5], n = ring.length, ramp = mk.length > 0
	let env = s[0], gr = s[1], sum = s[2], j = s[3] | 0
	for (let i = 0; i < x.length; i++) {
		let v = x[i], y = v * db2lin(gr), sq = y * y, mu = 0          // feedback: detect the compressed output
		for (let t = 0; t < 2; t++) {
			sum += sq - ring[j]; ring[j] = sq; j = (j + 1) % n
			let mag = Math.sqrt(Math.max(0, sum / n)), c = mag > env ? aC : rE
			env = c * env + (1 - c) * mag
			if (!t) mu = 1.8 + Math.max(0, lin2db(env) - T) / 5        // ratio grows with drive
		}
		let target = compressorGain(lin2db(env), T, mu, W)
		gr = target < gr ? target + (gr - target) * aC : target + (gr - target) * rC
		out[i] = v * db2lin(gr + (ramp ? mk[i] : m))
	}
	s[0] = env; s[1] = gr; s[2] = sum; s[3] = j
	return out
}
const NONE = new Float64Array(0)

return { varimu, varimuStream, varimuBlock, default: varimu };
})();

const varimu = (() => {
const { varimuBlock } = module14;
const { timeCoef, glide, GLIDE } = module13;
// atom manifest — vari-mu compressor (Fairchild class: feedback topology, very soft
// wide knee, slow attack, ratio grows with drive). Every param is live: read each
// block, the attack and release coefficients recomputed when their value changes, the
// follower and the gain reduction kept, so a change is heard from the next sample with
// no jump in the gain. State and settings are typed arrays made here; a block allocates
// nothing. No tail: the output is the input times a gain, silent when the input is.
// threshold and knee reach the output through the gain reduction's attack and release.
// makeup scales the output with nothing behind it, so it is smoothed (20 ms) and glided
// sample by sample (util.js glide): a host's ramp of it is one line of the gain,
// however the host cut its calls. Held, it is k's, and the kernel runs as it ran.

const varimu = (ctx) => {
	const sr = ctx.sampleRate, st = [], rings = [], k = new Float64Array(6), at = new Float64Array(2).fill(NaN)
	const g = new Float64Array(GLIDE).fill(NaN), mk = new Float64Array(ctx.maxBlockSize)
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) { st.push(new Float64Array(4)); rings.push(new Float32Array(256)) }
	k[5] = timeCoef(1, sr)
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		const a = params.attack[0], r = params.release[0]
		k[0] = params.threshold[0]; k[1] = params.knee[0]; k[2] = params.makeup[0]
		if (a !== at[0]) { at[0] = a; k[3] = timeCoef(a, sr) }
		if (r !== at[1]) { at[1] = r; k[4] = timeCoef(r, sr) }
		const ramp = glide(g, 0, params.makeup, mk, 0, inp[0].length, 0) ? mk : undefined
		for (let c = 0; c < inp.length; c++) varimuBlock(inp[c], out[c], st[c], rings[c], k, ramp)
	}
}
varimu.channels = 'any'
varimu.tail = 0
varimu.params = {
	threshold: { type: 'number', min: -60, max: 0, default: -22, unit: 'dB' },
	knee:      { type: 'number', min: 6, max: 30, default: 15, unit: 'dB' },
	attack:    { type: 'number', min: 5, max: 200, default: 25, unit: 'ms' },
	release:   { type: 'number', min: 50, max: 2000, default: 400, unit: 'ms' },
	makeup:    { type: 'number', min: -12, max: 24, default: 0, unit: 'dB', smoothing: 0.02 },
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

// A key bus that carries channels feeds the detector in place of the input: a mono key serves every channel, and one
// of fewer channels than the input serves them in turn. A key bus that nothing feeds has no channels (contract 1.0:
// Channels, process): each channel then reads itself. "We could instead feed in an arbitrary signal in the side-chain,
// in order to achieve side-chaining operation (e.g., to implement a ducker or a de-esser)" (Giannoulis, Massberg &
// Reiss 2012, §3.1.1).
const keyed = (key, x, c) => key && key.length ? key[c % key.length] : x[c]

// Stereo link, 0 to 1: each channel's level made, in place, link times the loudest channel's plus (1 − link) times its
// own, sample by sample. At 1 every channel reads one level and takes one gain, so linked channels act together when
// one crosses the threshold and the stereo image holds (Jeffs, Holden & Bohn, "Dynamics Processors: Technology &
// Applications", RaneNote 155, 2005, ch. 1). \`lev\`: a Float64Array per channel, \`nc\` channels of \`n\` samples, each the
// level the kernel's gain computer reads (linear); \`at\`: the link in its first slot, the param's own array (a number V8
// passes to a call it does not inline is a new object; Node 20 and 22 did so here as link moved every call).
function link(lev, nc, n, at) {
  let amt = at[0], own = 1 - amt
  for (let i = 0; i < n; i++) {
    let m = lev[0][i]
    for (let c = 1; c < nc; c++) if (lev[c][i] > m) m = lev[c][i]
    for (let c = 0; c < nc; c++) lev[c][i] = amt * m + own * lev[c][i]
  }
}

// dst[i] = db2lin(src[j]), and dst[i] = timeCoef(src[j], sampleRate), their arithmetic written out: the manifests'
// coefficients, with only arrays and indices crossing the call and none made inside it. A number V8 passes to a call it
// does not inline is a new object, and Node 20 and 22 left such calls out of the manifests' process once it read a key
// and linked channels: a block allocated as values moved.
function linAt(dst, i, src, j) { dst[i] = Math.exp(src[j] * (Math.LN10 / 20)) }
function coefAt(dst, i, src, j, sampleRate) { let ms = src[j]; dst[i] = ms <= 0 ? 0 : Math.exp(-1 / (ms * 0.001 * sampleRate)) }

// A value that scales the signal, glided sample by sample so that a host's steps of it join into one line. A host hands
// each call the value at its first frame and, while a value moves (a \`smoothing\` ramp), calls with 32 frames at most
// (contract 1.0: Parameters, Time; What a host owes, 3). So the line through the values the calls bring, each at its
// call's first frame, is known 32 frames behind any call's first frame, however the host cut the calls; the glide plays
// it 32 frames late. Straight from the value of one call to the next's, it is the host's ramp itself, in the value's
// own unit, the same whether the host calls with 1, 32 or a mix of frames; drawn between each call's end and the next
// (a glide across each call), a ramp cut 32, 4, 32 would put 32 frames of it into 4. A value that follows a call of
// more than 32 frames came with no ramp: it is reached in a straight line over 32 frames. The first call of an
// instance starts on its value, and a value held 32 frames is the value itself, so a value that does not move is
// bit for bit what it was before the glide existed.
// \`g\`: the memory, GLIDE slots a value from j·GLIDE (made NaN): the value the last call brought, where in the ring its
// first frame is, its frames, the frames the line had been at that value before it (64 once held and the ring all of
// it; counted to 63 at most, so that a long call after a move cannot reach 64 before the ring is made all of it), how
// many of \`row\`'s hold it, then the line, a frame a slot, in a ring of 64. \`src\`: the param's array. The
// line's values for this call's \`n\` frames go to \`row\` from \`at\`: as they are, or with \`lin\` 1 the gain e^(v·ln10/20)
// of a value in dB, per sample, so the gain follows the host's ramp of the dB value. Returns 1 while they move, 0 when
// every one is the value (then \`row\` holds it, filled once, and a caller may run its kernel on the value alone). Only
// arrays and whole numbers cross the call.
const GLIDE = 69
function glide(g, j, src, row, at, n, lin) {
  let o = j * GLIDE, r = o + 5, v = src[0], was = g[o]
  if (!(was === was)) { g[o] = v; g[o + 1] = 0; g[o + 2] = n; g[o + 3] = 0; g[o + 4] = 0 }
  else if (v !== was || g[o + 3] < 64) {
    let len = g[o + 2], L = len < 32 ? len : 32, w = (g[o + 1] + len) & 63, d = v - was, held = v === was ? Math.min(g[o + 3] + len, 63) : 0
    for (let q = 0; q < L; q++) g[r + ((w - L + q) & 63)] = was + d * q / L
    g[r + w] = v
    g[o] = v; g[o + 1] = w; g[o + 2] = n; g[o + 3] = held; g[o + 4] = 0
    if (held < 32) {
      for (let i = 0; i < n; i++) {
        let u = i < 32 ? g[r + ((w + i - 32) & 63)] : v
        row[at + i] = lin ? Math.exp(u * (Math.LN10 / 20)) : u
      }
      return 1
    }
  } else { g[o + 1] = (g[o + 1] + g[o + 2]) & 63; g[o + 2] = n }
  // held 32 frames: the ring made all of the value once (a move from it reads the line from there), the row filled
  // with it as far as no call since it was held has filled it; from then on a call only moves the ring's position
  if (g[o + 3] < 64) { for (let q = 0; q < 64; q++) g[r + q] = v; g[o + 3] = 64 }
  if (g[o + 4] < n) {
    let u = lin ? Math.exp(v * (Math.LN10 / 20)) : v
    for (let i = 0; i < n; i++) row[at + i] = u
    g[o + 4] = n
  }
  return 0
}

return { db2lin, lin2db, timeCoef, writer, concat, keyed, link, linAt, coefAt, GLIDE, glide };
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
  // copied into compressBlock's typed form and back; SET and POLES are scratch: compressBlock calls nothing that comes here
  let set = SET, p = POLES, up = c.upThreshold != null
  set[0] = c.threshold; set[1] = c.ratio; set[2] = c.knee
  set[3] = up ? 1 : 0; set[4] = up ? c.upThreshold : 0; set[5] = c.upRatio; set[6] = c.upKnee; set[7] = c.upRange
  set[8] = depth; set[9] = makeup; set[10] = s.aA; set[11] = s.aR; set[12] = s.rms ? 1 : 0; set[13] = s.n
  p[0] = s.y1; p[1] = s.y; p[2] = s.sum; p[3] = s.i
  compressBlock(x, out, p, set, s.buf)
  s.y1 = p[0]; s.y = p[1]; s.sum = p[2]; s.i = p[3]
  return out
}
const SET = new Float64Array(14), POLES = new Float64Array(4)

/** \`compress\` on typed arrays, allocating nothing: \`p\`, one channel's state, Float64Array(4): the smoother's poles y₁
 *  and y, the RMS window's sum and position; \`buf\`, the window's squares (Float64Array, empty for peak). \`set\`, the
 *  settings, Float64Array(14): threshold, ratio, knee; 1 when upward compression is on (0: off), upThreshold, upRatio,
 *  upKnee, upRange; depth, makeup; the smoother's attack and release coefficients, eq. (7); 1 for RMS (0: peak), the
 *  window's length. Its two halves, compressLevel and compressGain, let a level come from elsewhere between them (a
 *  key, the loudest of linked channels). */
function compressBlock(x, out, p, set, buf) {
  if (LEV.length < x.length) LEV = new Float64Array(x.length)
  compressLevel(x, LEV, p, set, buf)
  return compressGain(x, LEV, out, p, set)
}
let LEV = new Float64Array(0)

/** compressBlock's detector: the level of each sample of \`x\` into \`lev\` (Float64Array, as long or longer), |x| or the
 *  RMS window's mean square, linear. \`p\`, \`set\`, \`buf\` as compressBlock's (the window's sum and position change here). */
function compressLevel(x, lev, p, set, buf) {
  let rms = set[12] === 1, n = set[13] | 0, sum = p[2], j = p[3] | 0
  for (let i = 0; i < x.length; i++) {
    let v = x[i]
    if (rms) {
      let sq = v * v
      sum += sq - buf[j]; buf[j] = sq; j = (j + 1) % n
      lev[i] = sum / n
    } else lev[i] = Math.abs(v)
  }
  p[2] = sum; p[3] = j
}

/** compressBlock's gain computer and smoother: \`x\` into \`out\` (which may be \`x\`), each sample by the gain of its level
 *  in \`lev\`, as compressLevel gives it. \`p\`, \`set\` as compressBlock's (the smoother's poles change here). \`mk\`: the
 *  makeup (dB) for each sample (Float64Array, as long or longer), as a host's ramp moves it; empty (the default),
 *  \`set\`'s. */
function compressGain(x, lev, out, p, set, mk = NONE) {
  let T = set[0], R = set[1], K = set[2], up = set[3] === 1, uT = set[4], uR = set[5], uK = set[6], uG = set[7], depth = set[8], makeup = set[9]
  let aA = set[10], aR = set[11], rms = set[12] === 1, bA = 1 - aA, bR = 1 - aR, y1 = p[0], y = p[1], ramp = mk.length > 0
  // Level: |x| in dB, or the window's mean square in dB (10·log10), floored at −200 dB
  let floor = rms ? 1e-20 : 1e-10, k = (rms ? 10 : 20) / Math.LN10
  // Under T − K/2 the downward curve is exactly 0, over uT + uK/2 the upward one exactly its resting value (and
  // everywhere when upRatio is 1): between, the gain is known without the level, so the log is taken only off
  // this band. Its edges are compared in the linear level, set 1e-9 inside (~1e-8 dB), far over the log's
  // rounding, so a level in the band is one the dB comparison puts there too. Absurd thresholds (~1e3 dB, where
  // that rounding nears the margin) or NaN leave the band empty: every sample then takes the log.
  // (An empty band is hi = −1, not lo = Infinity: a constant Infinity among lo's values made V8 box lo once a block.)
  let hi = Math.abs(T) + Math.abs(K) < 1e3 ? Math.exp((T - K / 2) / k) * (1 - 1e-9) : -1
  if (!(hi > floor)) hi = -1
  let lo = -1
  if (up) {
    if (!(Math.abs(uT) + Math.abs(uK) < 1e3)) hi = -1
    else if (uR !== 1) lo = Math.exp((uT + uK / 2) / k) * (1 + 1e-9)
  }
  let g0 = 0
  if (hi > lo) {
    let db = k * Math.log(hi)
    g0 = compressorGain(db, T, R, K)
    if (up) g0 += upwardGain(db, uT, uR, uK, uG)
  }

  for (let i = 0; i < x.length; i++) {
    let v = x[i], l = lev[i], g = g0
    if (!(l > lo && l < hi)) {
      let db = k * Math.log(Math.max(l, floor))
      g = compressorGain(db, T, R, K)
      if (up) g += upwardGain(db, uT, uR, uK, uG)
    }
    // smoother(), eq. (17), on the reduction −g, inline
    let r = aR * y1 + bR * -g
    y1 = -g > r ? -g : r
    y = aA * y + bA * y1
    out[i] = v * db2lin(-y * depth + (ramp ? mk[i] : makeup))
  }
  p[0] = y1; p[1] = y
  return out
}
const NONE = new Float64Array(0)

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

return { compressor, compressorStream, compressorState, compress, compressBlock, compressLevel, compressGain, gainDb, detector, smoother, compressorGain, upwardGain, default: compressor };
})();

const compressor = (() => {
const { compressLevel, compressGain } = module17;
const { coefAt, keyed, link, glide, GLIDE } = module16;
// atom manifest — wraps the dynamics compressor kernel per @audio/compile CONTRACT.
// Every param is live: read each block, the smoother's attack and release coefficients
// recomputed when their value changes, its poles kept, so a change is heard from the
// next sample with no jump in the gain. State and settings are typed arrays made here
// (compressLevel and compressGain, the halves of compress); a block allocates nothing.
// Upward compression (below threshold) sums with downward in the dB domain — see
// compressor.js. The params convention has no null, so upRatio defaults to 1: a
// mathematical no-op (upwardGain ≡ 0 for any threshold/knee/level when ratio is 1),
// which is the off-switch here in place of the kernel's \`upThreshold: null\`.
// Input bus 1 is the key (fed by the \`key\` option): when it carries channels the
// detector reads them in place of the input (util.js keyed). \`link\` mixes each channel's
// level toward the loudest channel's (util.js link): every channel's level is read
// before any channel's gain, into rows made here by ctx.maxBlockSize. At link 0 and no
// key the kernel runs as compress does, sample for sample.
// No tail: the output is the input times a gain, silent when the input is.
// The curves' settings reach the output through the smoother. makeup scales the output
// with nothing behind it, so it is smoothed (20 ms) and glided sample by sample (util.js
// glide): a host's ramp of it is one line of the gain, however the host cut its calls.
// Held, it is k's, and the kernel runs as it ran.

const compressor = (ctx) => {
	const sr = ctx.sampleRate, st = [], lev = [], buf = new Float64Array(0), k = new Float64Array(14), at = new Float64Array(2).fill(NaN)
	const g = new Float64Array(GLIDE).fill(NaN), mk = new Float64Array(ctx.maxBlockSize)
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) { st.push(new Float64Array(4)); lev.push(new Float64Array(ctx.maxBlockSize)) }
	k[3] = 1; k[8] = 1   // upward on (upRatio 1 is its off), depth 1; peak detection
	return (inputs, outputs, params) => {
		const inp = inputs[0], key = inputs[1], out = outputs[0]
		if (!inp || !inp.length) return
		const a = params.attack[0], r = params.release[0], ln = params.link[0], nc = inp.length, n = inp[0].length
		k[0] = params.threshold[0]; k[1] = params.ratio[0]; k[2] = params.knee[0]
		k[4] = params.upThreshold[0]; k[5] = params.upRatio[0]; k[6] = params.upKnee[0]; k[7] = params.upRange[0]; k[9] = params.makeup[0]
		if (a !== at[0]) { at[0] = a; coefAt(k, 10, at, 0, sr) }
		if (r !== at[1]) { at[1] = r; coefAt(k, 11, at, 1, sr) }
		const ramp = glide(g, 0, params.makeup, mk, 0, n, 0) ? mk : undefined
		for (let c = 0; c < nc; c++) compressLevel(keyed(key, inp, c), lev[c], st[c], k, buf)
		if (ln > 0 && nc > 1) link(lev, nc, n, params.link)
		for (let c = 0; c < nc; c++) compressGain(inp[c], lev[c], out[c], st[c], k, ramp)
	}
}
compressor.channels = { inputs: [{ channels: 'any' }, { channels: 'any', name: 'key' }], outputs: 'any' }
compressor.tail = 0
compressor.params = {
	threshold:   { type: 'number', min: -60, max: 0, default: -20, smoothing: 0.01, unit: 'dB' },
	ratio:       { type: 'number', min: 1, max: 20, default: 4 },
	knee:        { type: 'number', min: 0, max: 24, default: 6, unit: 'dB' },
	makeup:      { type: 'number', min: -12, max: 24, default: 0, unit: 'dB', smoothing: 0.02 },
	upThreshold: { type: 'number', min: -80, max: 0, default: -40, smoothing: 0.01, unit: 'dB' },
	upRatio:     { type: 'number', min: 1, max: 20, default: 1 },
	upKnee:      { type: 'number', min: 0, max: 24, default: 6, unit: 'dB' },
	upRange:     { type: 'number', min: 0, max: 40, default: 12, unit: 'dB' },
	attack:      { type: 'number', min: 0.1, max: 100, default: 5, unit: 'ms' },
	release:     { type: 'number', min: 1, max: 1000, default: 100, unit: 'ms' },
	link:        { type: 'number', min: 0, max: 1, default: 0, smoothing: 0.01 },
}

return compressor;
})();
`;
