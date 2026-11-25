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

// e^(dB·ln10/20) and ln·20/ln10, not 10^(dB/20) and 20·log10: half the cost in V8 (exp and log take ~9 ns, pow
// and log10 ~17-19), a few double ulps from them, far under a float32 ulp.
const db2lin = (db) => Math.exp(db * (Math.LN10 / 20))

const lin2db = (lin) => 20 / Math.LN10 * Math.log(Math.max(Math.abs(lin), 1e-10))

// One-pole smoothing coefficient: y[n] = c·y[n-1] + (1-c)·x[n]. ms → coefficient.
function timeCoef(ms, sampleRate) {
  if (ms <= 0) return 0
  return Math.exp(-1 / (ms * 0.001 * sampleRate))
}

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

// A key bus that carries channels feeds the detector in place of the input: a mono key serves every channel, and one
// of fewer channels than the input serves them in turn. A key bus that nothing feeds has no channels (contract 1.0:
// Channels, process): each channel then reads itself. "We could instead feed in an arbitrary signal in the side-chain,
// in order to achieve side-chaining operation (e.g., to implement a ducker or a de-esser)" (Giannoulis, Massberg &
// Reiss 2012, §3.1.1).
const keyed = (key, x, c) => key && key.length ? key[c % key.length] : x[c]

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

return { db2lin, lin2db, timeCoef, writer2, concat, keyed, GLIDE, glide };
})();

const module5 = (() => {
const { compressorGain } = module3;
const { writer2, concat, db2lin, lin2db, timeCoef } = module4;

// External-sidechain compressor: main signal's gain is reduced in proportion
// to the level of a separate side signal (e.g. voice track ducking music).
function ducker(main, side, opts) {
  if (!(main instanceof Float32Array)) return writer2(duckerStream(main))
  let s = duckerStream(opts)
  return concat(s.write(main, side), s.flush())
}

function duckerStream(opts = {}) {
  let threshold = opts.threshold ?? -30
  let ratio = opts.ratio ?? 4
  let knee = opts.knee ?? 6
  let range = opts.range ?? -24  // max reduction in dB
  // the follower on the side signal: peak or RMS
  let sr = opts.sampleRate ?? opts.fs ?? 44100, rms = (opts.detector || 'peak') === 'rms'
  let k = Float64Array.of(threshold, ratio, knee, range, timeCoef(opts.attack ?? 20, sr), timeCoef(opts.release ?? 300, sr), rms ? 1 : 0)
  let s = new Float64Array(3), ring = new Float32Array(rms ? Math.max(1, opts.rmsWindow || 256) : 0)

  return {
    write(main, side) {
      let n = Math.min(main.length, side.length)
      let out = new Float32Array(main.length)
      duckBlock(main, side, out, s, ring, k)
      for (let i = n; i < main.length; i++) out[i] = main[i]
      return out
    },
    flush() { return new Float32Array(0) }
  }
}

/** One block of one channel into \`out\` (which may be \`x\`) over as many samples as both \`x\` and \`key\` hold, allocating
 *  nothing: \`x\` turned down by \`key\`'s level. \`s\`, the state: Float64Array(3), the follower, the RMS window's sum and
 *  position; \`ring\`, the window's squares (Float32Array of its length). \`k\`, the settings: Float64Array(7), threshold,
 *  ratio, knee, range (dB, the most it turns down), the follower's attack and release coefficients, 1 for RMS (0: peak).
 *  \`g\`: the threshold, ratio, knee and range for each sample, as a host's ramp moves them (Float64Array, from 0, M, 2·M
 *  and 3·M); empty (the default), \`k\`'s. */
function duckBlock(x, key, out, s, ring, k, g = NONE, M = 0) {
  let T = k[0], R = k[1], W = k[2], G = k[3], aa = k[4], ar = k[5], rms = k[6] === 1, n = ring.length, ramp = g.length > 0
  let env = s[0], sum = s[1], j = s[2] | 0
  for (let i = 0, len = Math.min(x.length, key.length); i < len; i++) {
    if (ramp) { T = g[i]; R = g[M + i]; W = g[2 * M + i]; G = g[3 * M + i] }
    let v = key[i], mag
    if (rms) {
      let sq = v * v
      sum += sq - ring[j]; ring[j] = sq; j = (j + 1) % n
      mag = Math.sqrt(Math.max(0, sum / n))
    } else mag = v < 0 ? -v : v
    let c = mag > env ? aa : ar
    env = c * env + (1 - c) * mag
    let rDb = compressorGain(lin2db(env), T, R, W)
    if (rDb < G) rDb = G
    out[i] = x[i] * db2lin(rDb)
  }
  s[0] = env; s[1] = sum; s[2] = j
  return out
}
const NONE = new Float64Array(0)

return { ducker, duckerStream, duckBlock, default: ducker };
})();

const ducker = (() => {
const { duckBlock } = module5;
const { timeCoef, keyed, glide, GLIDE } = module4;
// atom manifest — wraps the external-sidechain ducker kernel per @audio/compile
// CONTRACT §channels. The kernel cleanly separates the key input (duckerStream.write(main,
// side) takes two distinct signals), so this declares a genuine two-bus layout: main +
// key in, main out, each of any count, as the compressor, expander, gate, fet, opto and
// vca declare theirs. Every param is live: read each block, the follower's attack and
// release coefficients recomputed when their value changes, its state kept, so a change
// is heard from the next sample with no jump in the gain. State and settings are typed
// arrays made here; a block allocates nothing.
//
// NOTE: the audio host feeds bus 1 from its \`key\` option (chain.ducker({ key }) — rendered
// per block, rate-reconciled). The key is read as the family reads one (util.js keyed): a
// mono key serves every channel. When no key is given the bus has no channels (or a host
// that feeds only bus 0 leaves it undefined) and this keys off the main signal itself
// (self-compression, not true ducking).
// The follower reads the key; the curve's gain is applied with nothing behind it. So
// threshold, ratio, knee and range each set the gain at once: each is smoothed (20 ms)
// and glided sample by sample (util.js glide), so a host's ramp of it is one line,
// however the host cut its calls. While none moves they are k's, and the kernel runs as
// it ran.

const ducker = (ctx) => {
	const sr = ctx.sampleRate, M = ctx.maxBlockSize, st = [], ring = new Float32Array(0), k = new Float64Array(7), at = new Float64Array(2).fill(NaN)
	const g = new Float64Array(4 * GLIDE).fill(NaN), lanes = new Float64Array(4 * M)
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) st.push(new Float64Array(3))
	return (inputs, outputs, params) => {
		const main = inputs[0], side = inputs[1], out = outputs[0]
		if (!main || !main.length) return
		const a = params.attack[0], r = params.release[0], n = main[0].length
		k[0] = params.threshold[0]; k[1] = params.ratio[0]; k[2] = params.knee[0]; k[3] = params.range[0]
		const moving = glide(g, 0, params.threshold, lanes, 0, n, 0) | glide(g, 1, params.ratio, lanes, M, n, 0) | glide(g, 2, params.knee, lanes, 2 * M, n, 0) | glide(g, 3, params.range, lanes, 3 * M, n, 0)
		if (a !== at[0]) { at[0] = a; k[4] = timeCoef(a, sr) }
		if (r !== at[1]) { at[1] = r; k[5] = timeCoef(r, sr) }
		for (let c = 0; c < main.length; c++) duckBlock(main[c], keyed(side, main, c), out[c], st[c], ring, k, moving ? lanes : undefined, M)
	}
}
ducker.channels = { inputs: [{ channels: 'any' }, { channels: 'any', name: 'key' }], outputs: 'any' }
ducker.tail = 0
ducker.params = {
	threshold: { type: 'number', min: -60, max: 0, default: -30, smoothing: 0.02, unit: 'dB' },
	ratio:     { type: 'number', min: 1, max: 20, default: 4, smoothing: 0.02 },
	knee:      { type: 'number', min: 0, max: 24, default: 6, unit: 'dB', smoothing: 0.02 },
	range:     { type: 'number', min: -90, max: 0, default: -24, unit: 'dB', smoothing: 0.02 },
	attack:    { type: 'number', min: 0.1, max: 200, default: 20, unit: 'ms' },
	release:   { type: 'number', min: 1, max: 2000, default: 300, unit: 'ms' },
}

return ducker;
})();
`;