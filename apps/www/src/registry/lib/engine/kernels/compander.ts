/**
 * audio.js kernels, each module as published, in its own scope, for an
 * `AudioWorklet`, which cannot import them:
 * - `@audio/dynamics-envelope` 0.1.4 (MIT, Dmitry Iv.): `timeCoef`, as `module0`
 * - `@audio/dynamics-envelope` 0.1.4 (MIT, Dmitry Iv.): `envelope`, as `module1`
 * - `@audio/dynamics-compand` 0.2.1 (MIT, Dmitry Iv.): `writer`, `concat`, `db2lin`, `lin2db`, `timeCoef`, `GLIDE`, `glide`, as `module2`
 * - `@audio/dynamics-compand` 0.2.1 (MIT, Dmitry Iv.): `compand`, `compandStream`, `compandBlock`, as `module3`
 * - `@audio/dynamics-compand` 0.2.1 (MIT, Dmitry Iv.): `compand`
 */
export const COMPANDER_KERNELS = `const module0 = (() => {
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

// e^(dB·ln10/20) and ln·20/ln10, not 10^(dB/20) and 20·log10: half the cost in V8 (exp and log take ~9 ns, pow
// and log10 ~17-19), a few double ulps from them, far under a float32 ulp.
const db2lin = (db) => Math.exp(db * (Math.LN10 / 20))

const lin2db = (lin) => 20 / Math.LN10 * Math.log(Math.max(Math.abs(lin), 1e-10))

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

const module3 = (() => {
const { writer, concat, db2lin, lin2db, timeCoef } = module2;

// Multi-segment compander (SoX \`compand\`). Arbitrary piecewise-linear transfer
// in dB. A single curve unifies compression, expansion and gating: points below
// the identity line reduce loud parts; points above raise quiet parts.
function compand(data, opts) {
  if (!(data instanceof Float32Array)) return writer(compandStream(data))
  let s = compandStream(opts)
  return concat(s.write(data), s.flush())
}

function compandStream(opts = {}) {
  // Points: [[inDb, outDb], ...]. Default = mild compression above -20 dB.
  let points = (opts.points || [[-90, -90], [-60, -60], [-20, -20], [0, -8]])
    .slice().sort((a, b) => a[0] - b[0])
  if (!points.length) throw new RangeError('compand: points holds no [inDb, outDb] pair')
  // the follower: peak or RMS, attack and release
  let sr = opts.sampleRate ?? opts.fs ?? 44100, rms = (opts.detector || 'peak') === 'rms'
  let k = Float64Array.of(timeCoef(opts.attack ?? 5, sr), timeCoef(opts.release ?? 200, sr), rms ? 1 : 0)
  let s = new Float64Array(3), ring = new Float32Array(rms ? Math.max(1, opts.rmsWindow || 256) : 0), p = Float64Array.from(points.flatMap(q => [q[0], q[1]]))

  return {
    write(chunk) { return compandBlock(chunk, new Float32Array(chunk.length), s, ring, k, p) },
    flush() { return new Float32Array(0) }
  }
}

/** One block of one channel into \`out\` (which may be \`x\`), allocating nothing. \`s\`, the state: Float64Array(3), the
 *  follower, the RMS window's sum and position; \`ring\`, the window's squares (Float32Array of its length). \`k\`, the
 *  follower's settings: Float64Array(3), its attack and release coefficients, 1 for RMS (0: peak). \`p\`, the transfer
 *  curve: Float64Array of inDb, outDb, ..., sorted by inDb. \`g\`: each point's outDb for each sample (Float64Array,
 *  point j's from j·M), written into \`p\` sample by sample, as a host's ramp moves them; empty (the default), \`p\`'s. */
function compandBlock(x, out, s, ring, k, p, g = NONE, M = 0) {
  let aa = k[0], ar = k[1], rms = k[2] === 1, n = ring.length, env = s[0], sum = s[1], j = s[2] | 0, P = g.length > 0 ? p.length >> 1 : 0
  for (let i = 0; i < x.length; i++) {
    for (let q = 0; q < P; q++) p[2 * q + 1] = g[q * M + i]
    let v = x[i], mag
    if (rms) {
      let sq = v * v
      sum += sq - ring[j]; ring[j] = sq; j = (j + 1) % n
      mag = Math.sqrt(Math.max(0, sum / n))
    } else mag = v < 0 ? -v : v
    let c = mag > env ? aa : ar
    env = c * env + (1 - c) * mag
    let lvl = lin2db(env)
    out[i] = v * db2lin(transfer(p, lvl) - lvl)
  }
  s[0] = env; s[1] = sum; s[2] = j
  return out
}
const NONE = new Float64Array(0)

function transfer(p, x) {
  let e = p.length - 2
  if (x <= p[0]) return p[1] + (x - p[0])
  if (x >= p[e]) return p[e + 1] + (x - p[e])
  for (let i = 2; i <= e; i += 2) {
    if (x <= p[i]) {
      let t = (x - p[i - 2]) / (p[i] - p[i - 2])
      return p[i - 1] + t * (p[i + 1] - p[i - 1])
    }
  }
  return x
}

return { compand, compandStream, compandBlock, default: compand };
})();

const compand = (() => {
const { compandBlock } = module3;
const { timeCoef, glide, GLIDE } = module2;
// atom manifest — wraps the SoX-style compand kernel per @audio/compile CONTRACT.
// The kernel's transfer curve is an arbitrary array of [inDb, outDb] points — arrays
// aren't a valid CONTRACT param type (number/enum/bool only). Scalarized: the input
// breakpoints stay fixed at the kernel's own default shape (-90/-60/-20/0 dB) and the
// four output levels are number params. Every param is live: the output levels are
// written into the curve each block (each sample while one moves), the follower's
// coefficients recomputed when the attack or release changes, its state kept. State, settings and the curve are typed
// arrays made here; a block allocates nothing.
// An output level sets the gain at its level with nothing behind it (the follower reads
// the input), so each is smoothed (20 ms) and glided sample by sample (util.js glide): a
// host's ramp of it is one line, however the host cut its calls. While none moves the
// curve holds the four values, and the kernel runs as it ran.

const IN_DB = [-90, -60, -20, 0]

const compand = (ctx) => {
	const sr = ctx.sampleRate, M = ctx.maxBlockSize, st = [], ring = new Float32Array(0), k = new Float64Array(3), at = new Float64Array(2).fill(NaN)
	const p = Float64Array.from(IN_DB.flatMap(inDb => [inDb, 0])), g = new Float64Array(4 * GLIDE).fill(NaN), outs = new Float64Array(4 * M)
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) st.push(new Float64Array(3))
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		const a = params.attack[0], r = params.release[0], n = inp[0].length
		p[1] = params.out0[0]; p[3] = params.out1[0]; p[5] = params.out2[0]; p[7] = params.out3[0]
		const moving = glide(g, 0, params.out0, outs, 0, n, 0) | glide(g, 1, params.out1, outs, M, n, 0) | glide(g, 2, params.out2, outs, 2 * M, n, 0) | glide(g, 3, params.out3, outs, 3 * M, n, 0)
		if (a !== at[0]) { at[0] = a; k[0] = timeCoef(a, sr) }
		if (r !== at[1]) { at[1] = r; k[1] = timeCoef(r, sr) }
		for (let c = 0; c < inp.length; c++) compandBlock(inp[c], out[c], st[c], ring, k, p, moving ? outs : undefined, M)
	}
}
compand.channels = 'any'
compand.tail = 0
compand.params = {
	out0:    { type: 'number', min: -90, max: 0, default: -90, unit: 'dB', smoothing: 0.02 },
	out1:    { type: 'number', min: -90, max: 0, default: -60, unit: 'dB', smoothing: 0.02 },
	out2:    { type: 'number', min: -90, max: 0, default: -20, unit: 'dB', smoothing: 0.02 },
	out3:    { type: 'number', min: -90, max: 0, default: -8, unit: 'dB', smoothing: 0.02 },
	attack:  { type: 'number', min: 0.1, max: 200, default: 5, unit: 'ms' },
	release: { type: 'number', min: 1, max: 2000, default: 200, unit: 'ms' },
}

return compand;
})();
`;
