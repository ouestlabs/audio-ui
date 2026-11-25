/**
 * audio.js kernels, each module as published, in its own scope, for an
 * `AudioWorklet`, which cannot import them:
 * - `@audio/dynamics-envelope` 0.1.4 (MIT, Dmitry Iv.): `timeCoef`, as `module0`
 * - `@audio/dynamics-envelope` 0.1.4 (MIT, Dmitry Iv.): `envelope`, as `module1`
 * - `@audio/dynamics-gate` 0.2.1 (MIT, Dmitry Iv.): `writer`, `concat`, `db2lin`, `timeCoef`, `keyed`, `link`, `linAt`, `coefAt`, `GLIDE`, `glide`, as `module2`
 * - `@audio/dynamics-gate` 0.2.1 (MIT, Dmitry Iv.): `gate`, `gateStream`, `gateState`, `gateBlock`, `gateLevel`, `gateGain`, as `module3`
 * - `@audio/dynamics-gate` 0.2.1 (MIT, Dmitry Iv.): `gate`
 */
export const GATE_KERNELS = `const module0 = (() => {
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
function linAt(dst, i, src, j) { dst[i] = Math.pow(10, src[j] / 20) }
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

return { writer, concat, db2lin, timeCoef, keyed, link, linAt, coefAt, GLIDE, glide };
})();

const module3 = (() => {
const { writer, concat, db2lin, timeCoef } = module2;

// Noise gate with hysteresis, hold-then-close logic, look-ahead and smoothed
// gain transitions. The trigger envelope opens above \`threshold\` and, once
// open, only closes below \`closeThreshold\` (hysteresis prevents chatter near
// a single threshold); \`hold\` ms keeps the gate open after the level drops;
// attack/release smooth the gain trajectory. \`lookahead\` delays emission
// behind detection so the gate is already opening when a transient reaches
// the output — batch calls stay sample-aligned (write + flush covers the full
// signal, no silence prefix, no dropped tail); per-block hosts get the delay
// declared as latency (see audio.js).
function gate(data, opts) {
  if (!(data instanceof Float32Array)) return writer(gateStream(data))
  let s = gateStream(opts)
  return concat(s.write(data), s.flush())
}

function gateStream(opts = {}) {
  let sr = opts.sampleRate || 44100
  let threshold = opts.threshold ?? -40
  let closeThreshold = Math.min(opts.closeThreshold ?? threshold - 6, threshold)
  let range = opts.range ?? -60
  let hold = opts.hold ?? 10
  let attackMs = opts.attack ?? 0.1
  let releaseMs = opts.release ?? 100
  let lookahead = opts.lookahead ?? 0

  // Fast envelope drives the trigger (0.1 ms attack, 5 ms release, peak or RMS);
  // separate coefficients smooth the gate gain.
  let rms = (opts.detector || 'peak') === 'rms'
  let k = Float64Array.of(db2lin(threshold), db2lin(closeThreshold), db2lin(range), timeCoef(attackMs, sr), timeCoef(releaseMs, sr),
    Math.max(0, Math.round(hold * 0.001 * sr)), timeCoef(0.1, sr), timeCoef(5, sr), rms ? 1 : 0)
  let laSamp = Math.max(0, Math.round(lookahead * 0.001 * sr))
  let s = gateState(k[2]), ring = new Float32Array(rms ? 256 : 0), buf = new Float32Array(laSamp)

  return {
    write(chunk) {
      let out = new Float32Array(chunk.length), skip = gateBlock(chunk, out, s, ring, buf, k)
      return skip ? out.subarray(skip) : out
    },
    // the \`pending\` samples still in the delay line: zeros through it until they are out
    flush() {
      let p = s[7]
      if (!p) return new Float32Array(0)
      let out = new Float32Array(laSamp)
      gateBlock(out, out, s, ring, buf, k)
      s[7] = 0
      return out.subarray(laSamp - p)
    }
  }
}

/** One channel's state for gateBlock, the gate closed at gain \`closed\` (linear): the trigger follower, the RMS window's
 *  sum and position, the gain, the hold left (samples), 1 while open, the delay line's position and how full it is. */
const gateState = (closed) => Float64Array.of(0, 0, 0, closed, 0, 0, 0, 0)

/** One block of one channel into \`out\` (which may be \`x\`), allocating nothing. With a look-ahead, \`out\` lags \`x\` by the
 *  delay line's length; while the line first fills nothing comes out (0 there): returns how many samples that was.
 *  \`s\`, the state (gateState); \`ring\`, the RMS window's squares (Float32Array of its length, empty for peak); \`buf\`, the
 *  delay line (Float32Array of the look-ahead in samples, empty for none). \`k\`, the settings: Float64Array(9), the open,
 *  close and closed gains (linear), the gain's attack and release coefficients, the hold (samples), the trigger
 *  follower's attack and release coefficients, 1 for RMS (0: peak). */
function gateBlock(x, out, s, ring, buf, k) {
  if (LEV.length < x.length) LEV = new Float64Array(x.length)
  gateLevel(x, LEV, s, ring, k)
  return gateGain(x, LEV, out, s, buf, k)
}
let LEV = new Float64Array(0)

/** gateBlock's trigger follower: its level after each sample of \`x\` into \`lev\` (Float64Array, as long or longer),
 *  linear. \`s\`, \`ring\`, \`k\` as gateBlock's (the follower and the RMS window change here). gateLevel then gateGain is
 *  gateBlock, with room between them for a level from elsewhere (a key, the loudest of linked channels). */
function gateLevel(x, lev, s, ring, k) {
  let aE = k[6], rE = k[7], rms = k[8] === 1, n = ring.length
  let env = s[0], sum = s[1], j = s[2] | 0
  for (let i = 0; i < x.length; i++) {
    let v = x[i], mag
    if (rms) {
      let sq = v * v
      sum += sq - ring[j]; ring[j] = sq; j = (j + 1) % n
      mag = Math.sqrt(Math.max(0, sum / n))
    } else mag = v < 0 ? -v : v
    let c = mag > env ? aE : rE
    env = c * env + (1 - c) * mag
    lev[i] = env
  }
  s[0] = env; s[1] = sum; s[2] = j
}

/** gateBlock's gate: hysteresis, hold, the gain and the delay line, each sample of \`x\` into \`out\` (which may be \`x\`) by
 *  its trigger level in \`lev\`, as gateLevel gives it; returns the samples swallowed while the line first fills.
 *  \`s\`, \`buf\`, \`k\` as gateBlock's. \`cl\`: the closed gain (linear) for each sample (Float64Array, as long or longer), as a
 *  host's ramp of the range moves it; empty (the default), \`k\`'s. */
function gateGain(x, lev, out, s, buf, k, cl = NONE) {
  let openLin = k[0], closeLin = k[1], closedLin = k[2], aa = k[3], ar = k[4], holdSamp = k[5], ramp = cl.length > 0
  let L = buf.length, skip = 0
  let g = s[3], held = s[4], open = s[5] === 1, bi = s[6] | 0, pending = s[7]
  // Detection consumes the incoming sample; with look-ahead, emission returns a
  // sample laSamp behind it scaled by the *current* gain — the gate state at
  // emission already reflects material laSamp ahead, so attacks open in time.
  for (let i = 0; i < x.length; i++) {
    let v = x[i], env = lev[i], c
    let target
    if (env > openLin) { open = true; held = holdSamp; target = 1 }
    else if (held > 0) { held--; target = 1 }
    else if (open && env > closeLin) target = 1     // hysteresis band: stay open
    else { open = false; target = ramp ? cl[i] : closedLin }
    c = target > g ? aa : ar
    g = c * g + (1 - c) * target
    if (!L) { out[i] = v * g; continue }
    if (pending < L) { buf[bi] = v; bi = (bi + 1) % L; pending++; out[i] = 0; skip++; continue }
    let y = buf[bi] * g
    buf[bi] = v
    bi = (bi + 1) % L
    out[i] = y
  }
  s[3] = g; s[4] = held; s[5] = open ? 1 : 0; s[6] = bi; s[7] = pending
  return skip
}
const NONE = new Float64Array(0)

return { gate, gateStream, gateState, gateBlock, gateLevel, gateGain, default: gate };
})();

const gate = (() => {
const { gateLevel, gateGain, gateState } = module3;
const { db2lin, timeCoef, keyed, link, linAt, coefAt, glide, GLIDE } = module2;
// atom manifest — wraps the dynamics gate kernel per @audio/compile CONTRACT.
// The gate state machine (hysteresis, hold, trigger envelope, gain smoothing,
// look-ahead delay line) runs in gateBlock on typed state made here; a block
// allocates nothing. Every param but \`lookahead\` is live: read each block, the
// gains, the hold and the attack and release coefficients recomputed when their
// value changes, the gate's state kept, so a change is heard from the next sample
// with no jump in the gain. \`lookahead\` sets the delay line, so the latency: it is
// fixed for an instance (restart). With lookahead > 0 the delay line emits late —
// declared latency lets the host compensate; while it first fills, the block's head
// is silent.
// Input bus 1 is the key (fed by the \`key\` option): when it carries channels the
// trigger reads them in place of the input (util.js keyed). \`link\` mixes each channel's
// trigger level toward the loudest channel's (util.js link): every channel's level is
// read before any channel's gain, into rows made here by ctx.maxBlockSize. At link 0
// and no key the kernel runs as gateBlock does, sample for sample.
// \`range\` is the closed gain, the target the gain moves to at the attack (rising) or the
// release. The attack is the gate's opening speed, 0.1 ms by default: fast so an onset
// passes whole, and an onset masks it. A range raised while the gate is closed has no
// onset to mask it, so the gain stepped there (26.5 dB in one sample on a tone at
// −50 dB, range −60 → −20 dB). So range is smoothed (20 ms) and glided sample by sample
// (util.js glide, the closed gain e^(range·ln10/20) of each sample's range): the target
// moves as the host ramps it, and the gain follows it at the attack (held, it is k's, and
// the kernel runs as it ran). The thresholds stay as they were: a threshold the level
// then crosses opens or closes the gate as an onset or a decay would, at the gate's own
// attack and release.

const gate = (ctx) => {
	const sr = ctx.sampleRate, st = [], bufs = [], lev = [], ring = new Float32Array(0), k = new Float64Array(9), at = new Float64Array(6).fill(NaN)
	const L = Math.max(0, Math.round(ctx.params.lookahead[0] * 0.001 * sr)), g = new Float64Array(GLIDE).fill(NaN), closed = new Float64Array(ctx.maxBlockSize)
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) { st.push(gateState(db2lin(ctx.params.range[0]))); bufs.push(new Float32Array(L)); lev.push(new Float64Array(ctx.maxBlockSize)) }
	k[6] = timeCoef(0.1, sr); k[7] = timeCoef(5, sr)
	return (inputs, outputs, params) => {
		const inp = inputs[0], key = inputs[1], out = outputs[0]
		if (!inp || !inp.length) return
		const ln = params.link[0], nc = inp.length, n = inp[0].length, th = params.threshold[0], cl = params.closeThreshold[0], rg = params.range[0], hd = params.hold[0], a = params.attack[0], r = params.release[0]
		if (th !== at[0] || cl !== at[1]) { at[0] = th; at[1] = cl; linAt(k, 0, at, 0); k[1] = Math.min(cl, th); linAt(k, 1, k, 1) }
		if (rg !== at[2]) { at[2] = rg; linAt(k, 2, at, 2) }
		if (hd !== at[3]) { at[3] = hd; k[5] = Math.max(0, Math.round(hd * 0.001 * sr)) }
		if (a !== at[4]) { at[4] = a; coefAt(k, 3, at, 4, sr) }
		if (r !== at[5]) { at[5] = r; coefAt(k, 4, at, 5, sr) }
		const ramp = glide(g, 0, params.range, closed, 0, n, 1) ? closed : undefined
		for (let c = 0; c < nc; c++) gateLevel(keyed(key, inp, c), lev[c], st[c], ring, k)
		if (ln > 0 && nc > 1) link(lev, nc, n, params.link)
		for (let c = 0; c < nc; c++) gateGain(inp[c], lev[c], out[c], st[c], bufs[c], k, ramp)
	}
}
gate.channels = { inputs: [{ channels: 'any' }, { channels: 'any', name: 'key' }], outputs: 'any' }
gate.latency = (ctx) => Math.round(ctx.params.lookahead[0] * 0.001 * ctx.sampleRate)
gate.tail = 0
gate.params = {
	threshold:      { type: 'number', min: -80, max: 0, default: -40, unit: 'dB' },
	closeThreshold: { type: 'number', min: -90, max: 0, default: -46, unit: 'dB' },
	range:          { type: 'number', min: -90, max: 0, default: -60, unit: 'dB', smoothing: 0.02 },
	hold:           { type: 'number', min: 0, max: 500, default: 10, unit: 'ms' },
	attack:         { type: 'number', min: 0.01, max: 100, default: 0.1, unit: 'ms' },
	release:        { type: 'number', min: 1, max: 1000, default: 100, unit: 'ms' },
	lookahead:      { type: 'number', min: 0, max: 50, default: 0, unit: 'ms', restart: true },
	link:           { type: 'number', min: 0, max: 1, default: 0, smoothing: 0.01 },
}

return gate;
})();
`;
