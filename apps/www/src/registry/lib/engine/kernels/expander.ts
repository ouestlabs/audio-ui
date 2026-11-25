/**
 * audio.js kernels, each module as published, in its own scope, for an
 * `AudioWorklet`, which cannot import them:
 * - `@audio/dynamics-envelope` 0.1.4 (MIT, Dmitry Iv.): `timeCoef`, as `module0`
 * - `@audio/dynamics-envelope` 0.1.4 (MIT, Dmitry Iv.): `envelope`, as `module1`
 * - `@audio/dynamics-expander` 0.3.1 (MIT, Dmitry Iv.): `db2lin`, `lin2db`, `timeCoef`, `writer`, `concat`, `keyed`, `link`, `linAt`, `coefAt`, `GLIDE`, `glide`, as `module2`
 * - `@audio/dynamics-expander` 0.3.1 (MIT, Dmitry Iv.): `expander`, `expanderStream`, `expandBlock`, `expandLevel`, `expandGain`, `expanderGain`, `upwardExpanderGain`, as `module3`
 * - `@audio/dynamics-expander` 0.3.1 (MIT, Dmitry Iv.): `expander`
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

// One-pole smoothing coefficient: y[n] = c·y[n-1] + (1-c)·x[n]. ms → coefficient.
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
// level the kernel's gain computer reads (linear); the link sample by sample from \`row\` at \`at\` (the expander's gain
// follows its level with nothing behind it, so a moving link is glided: glide below). Only arrays and whole numbers
// cross the call (a number V8 passes to a call it does not inline is a new object; Node 20 and 22 did so here as link
// moved every call).
function link(lev, nc, n, row, at) {
  for (let i = 0; i < n; i++) {
    let amt = row[at + i], own = 1 - amt, m = lev[0][i]
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

const module3 = (() => {
const { writer, concat, db2lin, lin2db, timeCoef } = module2;

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
  // the follower: peak or RMS, attack 5 ms and release 50 by default
  let sr = opts.sampleRate ?? opts.fs ?? 44100, rms = (opts.detector || 'peak') === 'rms'
  let k = Float64Array.of(mode === 'upward' ? 1 : 0, threshold, ratio, knee, range, timeCoef(opts.attack ?? 5, sr), timeCoef(opts.release ?? 50, sr), rms ? 1 : 0)
  let s = new Float64Array(3), ring = new Float32Array(rms ? Math.max(1, opts.rmsWindow || 256) : 0)

  return {
    write(chunk) { return expandBlock(chunk, new Float32Array(chunk.length), s, ring, k) },
    flush() { return new Float32Array(0) }
  }
}

/** One block of one channel into \`out\` (which may be \`x\`), allocating nothing. \`s\`, the state: Float64Array(3), the
 *  follower, the RMS window's sum and position; \`ring\`, the window's squares (Float32Array of its length). \`k\`, the
 *  settings: Float64Array(8), 1 for upward (0: downward), threshold, ratio, knee, range (dB, signed as the curve
 *  takes it), the follower's attack and release coefficients, 1 for RMS (0: peak). Its two halves, expandLevel and
 *  expandGain, let a level come from elsewhere between them (a key, the loudest of linked channels). */
function expandBlock(x, out, s, ring, k) {
  if (LEV.length < x.length) LEV = new Float64Array(x.length)
  expandLevel(x, LEV, s, ring, k)
  return expandGain(x, LEV, out, k)
}
let LEV = new Float64Array(0)

/** expandBlock's follower: its level after each sample of \`x\` into \`lev\` (Float64Array, as long or longer), linear.
 *  \`s\`, \`ring\`, \`k\` as expandBlock's. */
function expandLevel(x, lev, s, ring, k) {
  let aa = k[5], ar = k[6], rms = k[7] === 1, n = ring.length
  let env = s[0], sum = s[1], j = s[2] | 0
  for (let i = 0; i < x.length; i++) {
    let v = x[i], mag
    if (rms) {
      let sq = v * v
      sum += sq - ring[j]; ring[j] = sq; j = (j + 1) % n
      mag = Math.sqrt(Math.max(0, sum / n))
    } else mag = v < 0 ? -v : v
    let c = mag > env ? aa : ar
    env = c * env + (1 - c) * mag
    lev[i] = env
  }
  s[0] = env; s[1] = sum; s[2] = j
}

/** expandBlock's gain: \`x\` into \`out\` (which may be \`x\`), each sample by the curve at its level in \`lev\`, as
 *  expandLevel gives it. \`k\` as expandBlock's. \`g\`: the threshold, ratio, knee and range for each sample, as a host's
 *  ramp moves them (Float64Array, from 0, M, 2·M and 3·M; the range a magnitude, signed here by \`k\`'s mode); empty
 *  (the default), \`k\`'s. */
function expandGain(x, lev, out, k, g = NONE, M = 0) {
  let up = k[0] === 1, T = k[1], R = k[2], W = k[3], G = k[4], ramp = g.length > 0
  for (let i = 0; i < x.length; i++) {
    if (ramp) { T = g[i]; R = g[M + i]; W = g[2 * M + i]; G = up ? g[3 * M + i] : -g[3 * M + i] }
    out[i] = x[i] * db2lin(expansion(lin2db(lev[i]), T, R, W, G, up))
  }
  return out
}
const NONE = new Float64Array(0)

// Soft-knee downward expansion curve. Returns gain reduction in dB (≤ 0).
function expanderGain(levelDb, threshold, ratio, kneeDb, rangeDb) {
  return expansion(levelDb, threshold, ratio, kneeDb, rangeDb, false)
}

// Soft-knee upward expansion curve — the above-threshold complement of
// expanderGain. Returns gain LIFT in dB (≥ 0), clamped to \`rangeDb\`. Same
// engagement topology as compressorGain (off below threshold, engaged above);
// positive instead of negative, (ratio-1) coefficient instead of (1-1/ratio)
// — expander ratios are "dB out per dB in" beyond threshold, compressor
// ratios are "dB in per dB out".
function upwardExpanderGain(levelDb, threshold, ratio, kneeDb, rangeDb) {
  return expansion(levelDb, threshold, ratio, kneeDb, rangeDb, true)
}

// Both curves in one body, upward or downward, so expandBlock calls one function in either mode: V8 boxed the result
// of a choice between the two calls (a number allocated a sample) wherever one of them had not run yet.
function expansion(levelDb, threshold, ratio, kneeDb, rangeDb, up) {
  let d = levelDb - threshold
  let r
  if (up) {
    if (d <= -kneeDb / 2) r = 0
    else if (d > kneeDb / 2) r = d * (ratio - 1)
    else {
      let x = d + kneeDb / 2
      r = (ratio - 1) * x * x / (2 * kneeDb)
    }
    return r > rangeDb ? rangeDb : r
  }
  if (d > kneeDb / 2) r = 0
  else if (d <= -kneeDb / 2) r = d * (ratio - 1)
  else {
    let x = d - kneeDb / 2
    r = -(ratio - 1) * x * x / (2 * kneeDb)
  }
  return r < rangeDb ? rangeDb : r
}

return { expander, expanderStream, expandBlock, expandLevel, expandGain, expanderGain, upwardExpanderGain, default: expander };
})();

const expander = (() => {
const { expandLevel, expandGain } = module3;
const { coefAt, keyed, link, glide, GLIDE } = module2;
// atom manifest — wraps the dynamics expander kernel per @audio/compile CONTRACT.
// Every param is live: read each block, the follower's attack and release coefficients
// recomputed when their value changes, its state kept, so a change is heard from the
// next sample with no jump in the gain. State and settings are typed arrays made here;
// a block allocates nothing.
// \`mode\` picks the curve (enum pattern mirrors deesser's \`mode\`): 'downward' (default)
// reduces gain below threshold; 'upward' raises gain above threshold — de-compression,
// the substrate for de-limiting over-squashed material. Both curves share the same
// envelope shape, only the gain formula switches.
// \`range\` is exposed as a magnitude (≥ 0), sign-applied by mode inside the processor,
// so switching modes can never strand a stale sign-mismatched value.
// Input bus 1 is the key (fed by the \`key\` option): when it carries channels the
// follower reads them in place of the input (util.js keyed). \`link\` mixes each channel's
// level toward the loudest channel's (util.js link): every channel's level is read
// before any channel's gain, into rows made here by ctx.maxBlockSize. At link 0 and no
// key the kernel runs as expandBlock does, sample for sample.
// The follower reads the input; the curve's gain is applied with nothing behind it. So
// threshold, ratio, knee, range and link each set the gain at once: each is smoothed
// (20 ms) and glided sample by sample (util.js glide), so a host's ramp of it is one
// line, however the host cut its calls. The range glides as a magnitude: a mode switch
// changes the curve at once (an enum does not glide) and never sweeps the range through 0.
// While none of the curve's four moves, they are k's, and the kernel runs as it ran.

const expander = (ctx) => {
	const sr = ctx.sampleRate, M = ctx.maxBlockSize, st = [], lev = [], ring = new Float32Array(0), k = new Float64Array(8), at = new Float64Array(2).fill(NaN)
	const g = new Float64Array(5 * GLIDE).fill(NaN), lanes = new Float64Array(5 * M)
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) { st.push(new Float64Array(3)); lev.push(new Float64Array(M)) }
	return (inputs, outputs, params) => {
		const inp = inputs[0], key = inputs[1], out = outputs[0]
		if (!inp || !inp.length) return
		const upward = params.mode === 'upward', a = params.attack[0], r = params.release[0], ln = params.link[0], nc = inp.length, n = inp[0].length
		k[0] = upward ? 1 : 0; k[1] = params.threshold[0]; k[2] = params.ratio[0]; k[3] = params.knee[0]
		k[4] = upward ? params.range[0] : -params.range[0]
		const moving = glide(g, 0, params.threshold, lanes, 0, n, 0) | glide(g, 1, params.ratio, lanes, M, n, 0) | glide(g, 2, params.knee, lanes, 2 * M, n, 0) | glide(g, 3, params.range, lanes, 3 * M, n, 0)
		const linking = glide(g, 4, params.link, lanes, 4 * M, n, 0)
		if (a !== at[0]) { at[0] = a; coefAt(k, 5, at, 0, sr) }
		if (r !== at[1]) { at[1] = r; coefAt(k, 6, at, 1, sr) }
		for (let c = 0; c < nc; c++) expandLevel(keyed(key, inp, c), lev[c], st[c], ring, k)
		if ((linking || ln > 0) && nc > 1) link(lev, nc, n, lanes, 4 * M)
		for (let c = 0; c < nc; c++) expandGain(inp[c], lev[c], out[c], k, moving ? lanes : undefined, M)
	}
}
expander.channels = { inputs: [{ channels: 'any' }, { channels: 'any', name: 'key' }], outputs: 'any' }
expander.tail = 0
expander.params = {
	mode:      { type: 'enum', values: ['downward', 'upward'], default: 'downward' },
	threshold: { type: 'number', min: -80, max: 0, default: -30, smoothing: 0.02, unit: 'dB' },
	ratio:     { type: 'number', min: 1, max: 20, default: 2, smoothing: 0.02 },
	knee:      { type: 'number', min: 0, max: 24, default: 6, unit: 'dB', smoothing: 0.02 },
	range:     { type: 'number', min: 0, max: 90, default: 40, unit: 'dB', smoothing: 0.02 },
	attack:    { type: 'number', min: 0.1, max: 100, default: 5, unit: 'ms' },
	release:   { type: 'number', min: 1, max: 1000, default: 50, unit: 'ms' },
	link:      { type: 'number', min: 0, max: 1, default: 0, smoothing: 0.02 },
}

return expander;
})();
`;
